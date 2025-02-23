import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PDFCard } from "@/components/PDFCard";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loadingSpinner";
import { useAuth } from "@/context/AuthContext";
import { useRef } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { isAuthenticated } = useAuth();

  const { data: pdfs = [], isLoading } = useQuery({
    queryKey: ["pdfs"],
    queryFn: async () => {
      // const {data} = await api.get('/api/pdfs');
      // return data;

      try {
        const { data } = await api.get("/api/pdfs");
        return data;
      } catch (error) {
        console.error("Failed to fetch PDFs:", error);
        return [];
      }
    },
    enabled: isAuthenticated,
  });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || file.type !== "application/pdf") {
      toast.error("Invalid file. Please upload a PDF file", {
        duration: 2000,
      });
      return;
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("title", file.name);

    try {
      await api.post("/api/pdfs", formData);

      // invalidate and refetch PDFs query
      await queryClient.invalidateQueries({ queryKey: ["pdfs"] });

      // Reset the file input after successful upload
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      toast.success("PDF uploaded successfully", {
        duration: 2000,
      });
    } catch (err) {
      console.error("Upload error", err);

      toast.error("Failed to upload PDF", {
        duration: 2000,
      });
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Library</h1>
        <Input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileUpload}
          className="hidden"
          disabled={!isAuthenticated}
        ></Input>
        <Button onClick={handleFileUploadClick}>Upload PDF</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pdfs.map((pdf: any) => {
          return (
            <PDFCard
              key={pdf.id}
              title={pdf.title}
              thumbnailUrl={pdf.thumbnail_path}
              uploadedAt={pdf.uploaded_at}
              // onClick={() => navigate({to: `/pdf/${pdf.id}`,
              // params: {pdfId: pdf.id}})}
              onClick={() =>
                navigate({ to: "/pdf/$pdfId", params: { pdfId: pdf.id } })
              }
            ></PDFCard>
          );
        })}
      </div>
    </div>
  );
}
