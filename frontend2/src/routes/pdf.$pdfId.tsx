import { createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loadingSpinner';
import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/pdf/$pdfId')({
  beforeLoad: ({context, location}) => {
    if(!context.auth.isAuthenticated){
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        }
      })
    }
  },
  component: PDFViewerPage,
})

function PDFViewerPage() {
  const {isLoading: isUserLoading} = useAuth();
  const { pdfId } = Route.useParams();
  
  const { data: pdf, isLoading } = useQuery({
    queryKey: ['pdf', pdfId],
    queryFn: async () => {
      const { data } = await api.get(`/api/pdfs/${pdfId}`);
      return data;
    },
  });

  if (isUserLoading) {
    return <LoadingSpinner />;
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!pdf) {
    return <div>PDF not found</div>;
  }

  return (
  <div className="container mx-auto px-4">
  <div className="bg-white rounded-lg shadow-lg p-6">
    <h1 className="text-2xl font-bold mb-4">{pdf.title}</h1>
    <div className="aspect-[16/9] w-full">
      <iframe
        src={`http://localhost:5000/api/pdfs/${pdfId}/view`}
        className="w-full h-full border-0 rounded-md"
        title={pdf.title}
      />
    </div>
  </div>
</div>);
}
