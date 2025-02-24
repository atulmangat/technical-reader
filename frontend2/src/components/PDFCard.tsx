import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface IPDFCard {
  title: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  onClick: () => void;
}

export const PDFCard = ({
  title,
  thumbnailUrl,
  uploadedAt,
  onClick,
}: IPDFCard) => {
  return (
    <Card onClick={onClick}>
      <CardHeader className="cursor-pointer hover:shadow-lg transition-shadow">
        <CardTitle className="truncate">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="aspect-[3/4] relative bg-gray-100 rounded-md overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="w-full h-full object-cover"
            ></img>
          ) : (
            <div className="flex items-center justify-center h-full">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                ></path>
              </svg>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Uploaded: {new Date(uploadedAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
};
