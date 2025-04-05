import { createFileRoute } from "@tanstack/react-router";
import { PdfSidebarContainer } from "../components/pdfIndex/sidebarContainer";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div>
      <PdfSidebarContainer />
    </div>
  );
}
