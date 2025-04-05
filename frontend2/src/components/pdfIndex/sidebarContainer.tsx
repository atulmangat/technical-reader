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
    title: "Chapter 3",
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
  {
    title: "Chapter 4",
    dest: "page15",
    items: [
      {
        title: "Glossary",
        dest: "page16",
      },
      {
        title: "References",
        dest: "page17",
      },
    ],
  },
  {
    title: "Chapter 5",
    dest: "page18",
    items: [
      {
        title: "Glossary",
        dest: "page19",
      },
      {
        title: "References",
        dest: "page20",
      },
    ],
  },
  {
    title: "Chapter 6",
    dest: "page21",
    items: [
      {
        title: "Glossary",
        dest: "page22",
      },
      {
        title: "References",
        dest: "page23",
      },
    ],
  },
  {
    title: "Chapter 7",
    dest: "page24",
    items: [
      {
        title: "Glossary",
        dest: "page25",
      },
      {
        title: "References",
        dest: "page26",
      },
    ],
  },
  {
    title: "Chapter 8",
    dest: "page27",
    items: [
      {
        title: "Glossary",
        dest: "page28",
      },
      {
        title: "References",
        dest: "page29",
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
    <PdfSidebar
      isLoading={isLoading}
      outline={outline}
      onItemClick={handleItemClick}
    />
  );
};
