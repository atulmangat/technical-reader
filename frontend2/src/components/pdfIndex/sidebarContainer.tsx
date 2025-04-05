import { useEffect, useState } from "react";
import { PdfSidebar } from "./sidebar";
import { TOutlineItem } from ".";

const sampleOutline = [
  {
    title: "Introduction",
    dest: "page1",
    items: [
      {
        title: "Overview",
        dest: "page2",
      },
      {
        title: "Purpose",
        dest: "page3",
      },
    ],
  },
  {
    title: "Chapter 1: Getting Started",
    dest: "page4",
    items: [
      {
        title: "Installation",
        dest: "page5",
      },
      {
        title: "Setup",
        dest: "page6",
        items: [
          {
            title: "Configuration",
            dest: "page7",
          },
          {
            title: "First Steps",
            dest: "page8",
          },
        ],
      },
    ],
  },
  {
    title: "Chapter 2: Advanced Topics",
    dest: "page9",
    items: [
      {
        title: "Performance Optimization",
        dest: "page10",
      },
      {
        title: "Security Best Practices",
        dest: "page11",
      },
    ],
  },
  {
    title: "Appendix",
    dest: "page12",
    items: [
      {
        title: "Glossary",
        dest: "page13",
      },
      {
        title: "References",
        dest: "page14",
      },
    ],
  },
];

export const PdfSidebarContainer = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [outline, setOutline] = useState<TOutlineItem[]>([]);

  useEffect(() => {
    // Simulating loading data
    const timer = setTimeout(() => {
      setOutline(sampleOutline);
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleItemClick = (dest: string) => {
    console.log("CLICKED_DEST", dest);
    // @todo navigation logic
  };

  return (
    <div className="w-64 border-r">
      <PdfSidebar
        isLoading={isLoading}
        outline={outline}
        onItemClick={handleItemClick}
      />
    </div>
  );
};
