import time
import logging
import threading
import json
from datetime import datetime
from .worker import PDFEmbeddingPipeline

class PDFProcessingMonitor:
    """
    A monitor class that periodically prints the progress of the PDF processing pipeline.
    """
    def __init__(self, pipeline: PDFEmbeddingPipeline, interval_seconds: int = 60, log_to_file: bool = True):
        """
        Initialize the monitor with a reference to the PDF embedding pipeline.
        
        Args:
            pipeline: The PDF embedding pipeline to monitor
            interval_seconds: How often to print progress (in seconds)
            log_to_file: Whether to log progress to a file instead of console
        """
        self.pipeline = pipeline
        self.interval = interval_seconds
        self.logger = logging.getLogger(__name__)
        self.is_running = False
        self.monitor_thread = None
        self.log_to_file = log_to_file
        
        # Clear any existing handlers
        self.logger.handlers = []
        
        # Set up file handler if logging to file
        if self.log_to_file:
            file_handler = logging.FileHandler('pdf_indexing.log')
            file_handler.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
            self.logger.addHandler(file_handler)
        else:
            # Add console handler if not logging to file
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(logging.Formatter('%(message)s'))
            self.logger.addHandler(console_handler)
            
        # Ensure logger will handle INFO messages
        self.logger.setLevel(logging.INFO)
        # Prevent propagation to root logger (which outputs to console)
        self.logger.propagate = False
        
    def _format_progress_bar(self, percentage, width=30):
        """Create a text-based progress bar"""
        filled_width = int(width * percentage / 100)
        bar = '█' * filled_width + '░' * (width - filled_width)
        return f"[{bar}] {percentage:.1f}%"
        
    def _print_progress(self):
        """Log detailed progress information to file or console"""
        try:
            progress = self.pipeline.get_detailed_progress()
            queue_status = progress["queue_status"]
            current_progress = progress["current_progress"]
            
            # Current time
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Build the progress message
            lines = []
            lines.append("="*80)
            lines.append(f"PDF PROCESSING STATUS - {now}")
            lines.append("="*80)
            
            # Queue information
            lines.append(f"\nQUEUE STATUS:")
            lines.append(f"  Items in queue: {queue_status['queue_size']}")
            lines.append(f"  Total added: {queue_status['total_added']}")
            lines.append(f"  Total processed: {queue_status['total_processed']}")
            
            # Status counts
            if 'status_counts' in queue_status and queue_status['status_counts']:
                lines.append("\n  Status breakdown:")
                for status, count in queue_status['status_counts'].items():
                    lines.append(f"    - {status}: {count}")
            
            # Current processing information
            lines.append("\nCURRENT PROCESSING:")
            if current_progress['current_pdf_id']:
                lines.append(f"  PDF ID: {current_progress['current_pdf_id']}")
                lines.append(f"  Chunks: {current_progress['processed_chunks']}/{current_progress['total_chunks']}")
                
                # Progress bar
                progress_bar = self._format_progress_bar(current_progress['progress_percentage'])
                lines.append(f"  Progress: {progress_bar}")
            else:
                lines.append("  No PDF currently being processed")
            
            # Worker status
            worker_status = "RUNNING" if progress["worker_running"] else "STOPPED"
            lines.append(f"\nWORKER STATUS: {worker_status}")
            
            lines.append("\n" + "-"*80)
            
            # Join all lines into a single message
            message = "\n".join(lines)
            
            # Log to file or print to console
            if self.log_to_file:
                self.logger.info(message)
            else:
                print(message)
            
        except Exception as e:
            self.logger.error(f"Error printing progress: {str(e)}")
    
    def _monitor_loop(self):
        """Main monitoring loop that prints progress at regular intervals"""
        self.logger.info(f"Starting PDF processing monitor (interval: {self.interval}s)")
        self.is_running = True
        
        while self.is_running:
            try:
                self._print_progress()
                time.sleep(self.interval)
            except Exception as e:
                self.logger.error(f"Monitor error: {str(e)}")
                time.sleep(1)
    
    def start(self):
        """Start the monitor in a separate thread"""
        if not self.is_running:
            self.monitor_thread = threading.Thread(target=self._monitor_loop)
            self.monitor_thread.daemon = True
            self.monitor_thread.start()
            return True
        return False
    
    def stop(self):
        """Stop the monitor"""
        if self.is_running:
            self.is_running = False
            if self.monitor_thread:
                self.monitor_thread.join(timeout=2)
            return True
        return False


# Example usage
if __name__ == "__main__":
    # Only configure basic logging for non-monitor logs
    logging.basicConfig(level=logging.INFO)
    
    # Create and start the pipeline
    pipeline = PDFEmbeddingPipeline()
    pipeline.start()
    
    # Create and start the monitor with file logging only
    monitor = PDFProcessingMonitor(pipeline, interval_seconds=60, log_to_file=True)
    monitor.start()
    
    try:
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        # Stop everything on Ctrl+C
        monitor.stop()
        pipeline.stop()
        print("\nMonitor and pipeline stopped.") 