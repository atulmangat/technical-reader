import * as pdfjsLib from 'pdfjs-dist';

// Set the workerSrc property to point to the worker file
const pdfjsWorkerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

export default pdfjsLib; 