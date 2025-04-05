import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
// import { ChevronRightIcon } from "lucide-react";
import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";
import { TOutlineItem } from "@/components/pdfIndex";

const projectInfo = {
  icon: "#",
  name: "ChatWithPdf",
  url: "/",
};

// export function PdfIndexSidebar() {
//   const renderOutlineItems = (items: OutlineItem[]) => {
//     return items.map((item, index) => {
//       const { title, dest, items: childItems } = item;

//       if (childItems && childItems.length > 0) {
//         return (
//           <Collapsible
//             defaultOpen
//             className="group/collapsible"
//             key={`collapsible-${index}`}
//           >
//             <SidebarMenuSubItem>
//               <CollapsibleTrigger asChild>
//                 <SidebarMenuSubButton>
//                   <span>{title}</span>
//                   <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
//                 </SidebarMenuSubButton>
//               </CollapsibleTrigger>
//               <CollapsibleContent>
//                 <SidebarMenuSub>
//                   {renderOutlineItems(childItems)}
//                 </SidebarMenuSub>
//               </CollapsibleContent>
//             </SidebarMenuSubItem>
//           </Collapsible>
//         );
//       }
//       return (
//         <SidebarMenuItem key={index}>
//           <SidebarMenuButton>{title}</SidebarMenuButton>
//         </SidebarMenuItem>
//       );
//     });
//   };

//   return (
//     <Sidebar>
//       <SidebarHeader>
//         <SidebarMenu>
//           <SidebarMenuItem>
//             <SidebarMenuButton asChild>
//               <Link to={projectInfo.url}>
//                 {projectInfo.icon}
//                 <span>{projectInfo.name}</span>
//               </Link>
//             </SidebarMenuButton>
//           </SidebarMenuItem>
//         </SidebarMenu>
//       </SidebarHeader>
//       <SidebarContent>
//         <SidebarGroup>
//           <SidebarGroupLabel />
//           <SidebarMenu>{renderOutlineItems(outline)}</SidebarMenu>
//         </SidebarGroup>
//         <SidebarGroup />
//       </SidebarContent>
//       <SidebarFooter />
//     </Sidebar>
//   );
// }

interface IPdfSidebarProps {
  isLoading?: boolean;
  outline?: TOutlineItem[];
  onItemClick: (dest: string) => void;
}

interface IOutlineContentProps {
  items: TOutlineItem[];
  onItemClick: (dest: string) => void;
  level?: number;
}

interface IOutlineItemProps {
  item: TOutlineItem;
  onItemClick: (dest: string) => void;
  level?: number;
}

export function PdfSidebar({
  isLoading = false,
  outline = [],
  onItemClick,
}: IPdfSidebarProps) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b">
          <div className="flex items-center gap-2 px-2 py-3">
            <FileText className="h-6 w-6" />
            <h2 className="text-lg font-semibold">Chat with PDF</h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {isLoading ? (
            <OutlineSkeleton />
          ) : outline.length > 0 ? (
            <OutlineContent items={outline} onItemClick={onItemClick} />
          ) : (
            <EmptyState />
          )}
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

// Component to render the outline content recursively
function OutlineContent({
  items,
  onItemClick,
  level = 0,
}: IOutlineContentProps) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item, index) => (
            <OutlineItem
              key={`${item.title}-${index}`}
              item={item}
              onItemClick={onItemClick}
              level={level}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// Component to render a single outline item
function OutlineItem({ item, onItemClick, level = 0 }: IOutlineItemProps) {
  const hasChildren = item.items && item.items.length > 0;
  const [isOpen, setIsOpen] = useState(level === 0);

  const handleItemClick = (e: React.MouseEvent) => {
    if (!hasChildren && item.dest && onItemClick) {
      onItemClick(item.dest);
    }
  };

  if (hasChildren) {
    return (
      <SidebarMenuItem>
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
          <CollapsibleTrigger className="w-full">
            <div className="flex w-full items-center justify-between rounded-md p-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <span className="truncate">{item.title}</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-4 border-l pl-2 pt-1">
              <OutlineContent
                items={item.items!}
                onItemClick={onItemClick}
                level={level + 1}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild={!!item.dest || !!item.url}
        onClick={handleItemClick}
      >
        {item.dest || item.url ? (
          <a href={item.url || "#"} className="truncate">
            {item.title}
          </a>
        ) : (
          <span className="truncate">{item.title}</span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// Skeleton loading state
function OutlineSkeleton() {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="animate-pulse">
        <SidebarMenu>
          {Array.from({ length: 5 }).map((_, i) => (
            <SidebarMenuItem key={i} className="py-1">
              <div className="flex items-center">
                <div className="h-5 w-full rounded bg-muted"></div>
              </div>
              {i % 2 === 0 && (
                <div className="ml-4 mt-2 space-y-2 border-l pl-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="h-4 w-[80%] rounded bg-muted"></div>
                  ))}
                </div>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// Empty state when no outline is available
function EmptyState() {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
      <FileText className="h-10 w-10 opacity-50" />
      <p>No outline available for this document</p>
    </div>
  );
}
