export type TOutlineItem = {
  title: string; // The title of the section or item
  dest?: string; // The destination within the PDF (optional)
  url?: string; // External URL (optional, for links outside the PDF)
  items?: TOutlineItem[]; // Nested children (optional)
};
