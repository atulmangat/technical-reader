import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PdfSidebarContainer } from "@/components/pdfIndex/sidebarContainer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <PdfSidebarContainer />
      <main>
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}
