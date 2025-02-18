from flask import Blueprint, request, jsonify, send_file, current_app, Response, stream_with_context
from werkzeug.utils import secure_filename
import os
import requests
from .models import db, PDF
from flask_login import login_required, current_user
from .utils import generate_pdf_thumbnail
from .embedding_utils import PDFEmbeddingPipeline, PDFProcessingQueue

api = Blueprint('api', __name__)

# Add environment variable for API key
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

# Initialize the embedding pipeline
pdf_pipeline = PDFEmbeddingPipeline()

# Initialize the PDF processing queue
pdf_queue = PDFProcessingQueue()

@api.route('/pdfs', methods=['GET'])
@login_required
def get_pdfs():
    pdfs = PDF.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': pdf.id,
        'title': pdf.title,
        'filename': pdf.filename,
        'thumbnail_path': pdf.thumbnail_path,
        'uploaded_at': pdf.uploaded_at.isoformat(),
        'description': pdf.description,
        'file_size': pdf.file_size,
        'notes': pdf.notes
    } for pdf in pdfs])

@api.route('/pdfs', methods=['POST'])
@login_required
def upload_pdf():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    if file and file.filename.endswith('.pdf'):
        filename = secure_filename(file.filename)
        
        # Generate thumbnail
        thumbnail_path = generate_pdf_thumbnail(file)
        
        # Save PDF
        relative_path = os.path.join('uploads', filename)
        absolute_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
        
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        file.save(absolute_path)
        
        pdf = PDF(
            title=request.form.get('title', filename),
            filename=filename,
            file_path=relative_path,
            thumbnail_path=thumbnail_path,
            file_size=file_size,
            user_id=current_user.id,
            has_embeddings=False
        )
        db.session.add(pdf)
        db.session.commit()
        
        # Add PDF to processing queue
        pdf_queue.add_to_queue(pdf.id, absolute_path, db)
        
        return jsonify({
            'id': pdf.id,
            'title': pdf.title,
            'filename': pdf.filename,
            'thumbnail_path': pdf.thumbnail_path,
            'file_size': file_size,
            'has_embeddings': pdf.has_embeddings
        }), 201
    
    return jsonify({'error': 'Invalid file type'}), 400

@api.route('/pdfs/<int:pdf_id>', methods=['GET'])
def get_pdf(pdf_id):
    pdf = PDF.query.get_or_404(pdf_id)
    
    # Convert relative path to absolute path
    absolute_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        pdf.file_path
    )
    
    if not os.path.exists(absolute_path):
        return jsonify({'error': 'PDF file not found'}), 404
        
    return send_file(
        absolute_path,
        mimetype='application/pdf',
        as_attachment=False,
        download_name=pdf.filename
    )

@api.route('/pdfs/<int:pdf_id>/notes', methods=['POST'])
def save_notes(pdf_id):
    pdf = PDF.query.get_or_404(pdf_id)
    pdf.notes = request.json.get('notes')
    db.session.commit()
    return jsonify({'message': 'Notes saved successfully'})

@api.route('/chat/completions', methods=['POST'])
def chat_completion():
    try:
        if not DEEPSEEK_API_KEY:
            return jsonify({'error': 'DeepSeek API key not configured'}), 500

        data = request.json
        question = data.get('question')
        pdf_id = data.get('pdf_id')  # Add PDF ID to the request
        history = data.get('history', [])
        stream = data.get('stream', True)
        
        # Get relevant context using embeddings
        # relevant_chunks = pdf_pipeline.get_relevant_chunks(question, pdf_id)
        # context = "\n".join(relevant_chunks)
        
        messages = [
            {"role": "system", "content": "You are a helpful assistant that answers questions about PDF content."}
        ]
        
        # Add chat history
        messages.extend(history)
        
        # Add current context and question
        # if context:
        #     messages.append({"role": "user", "content": f"Context from PDF: \"{context}\""})
        messages.append({"role": "user", "content": question})

        response = requests.post(
            DEEPSEEK_API_URL,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {DEEPSEEK_API_KEY}'
            },
            json={
                'model': 'deepseek-chat',
                'messages': messages,
                'stream': stream
            },
            stream=stream
        )

        print(f"DeepSeek API Response Status: {response.status_code}")  # Debug log

        if response.status_code == 401:
            return jsonify({'error': 'Invalid API key or authentication failed'}), 401
        elif not response.ok:
            error_data = response.json()
            print(f"DeepSeek API Error: {error_data}")  # Debug log
            return jsonify({
                'error': f'API call failed: {error_data.get("error", response.status_code)}'
            }), response.status_code

        if stream:
            def generate():
                try:
                    for line in response.iter_lines():
                        if line:
                            decoded_line = line.decode('utf-8')
                            yield f"data: {decoded_line}\n\n"
                    yield "data: [DONE]\n\n"
                except Exception as e:
                    print(f"Error in generate(): {e}")  # Debug log
                    raise

            return Response(
                stream_with_context(generate()),
                mimetype='text/event-stream',
                headers={
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no'
                }
            )
        else:
            return response.json()

    except requests.exceptions.RequestException as e:
        print(f"Request Exception: {e}")  # Debug log
        return jsonify({'error': f'Network error: {str(e)}'}), 503
    except Exception as e:
        print(f"General Exception: {e}")  # Debug log
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@api.route('/pdfs/<int:pdf_id>/highlights', methods=['GET', 'POST'])
@login_required
def handle_highlights(pdf_id):
    pdf = PDF.query.filter_by(id=pdf_id, user_id=current_user.id).first_or_404()
    
    if request.method == 'POST':
        highlight = request.json
        if not pdf.highlights:
            pdf.highlights = []
        pdf.highlights.append(highlight)
        db.session.commit()
        return jsonify(highlight)
    
    return jsonify(pdf.highlights or [])

@api.route('/pdfs/<int:pdf_id>/highlights/<int:highlight_id>', methods=['DELETE'])
@login_required
def delete_highlight(pdf_id, highlight_id):
    pdf = PDF.query.filter_by(id=pdf_id, user_id=current_user.id).first_or_404()
    if pdf.highlights and highlight_id < len(pdf.highlights):
        pdf.highlights.pop(highlight_id)
        db.session.commit()
    return '', 204

# Add a new endpoint to check queue status
@api.route('/pdfs/queue-status', methods=['GET'])
@login_required
def get_queue_status():
    status = pdf_queue.get_queue_status()
    return jsonify(status) 