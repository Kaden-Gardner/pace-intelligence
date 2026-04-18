import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

/**
 * MobileSelect — uses a bottom-sheet drawer on mobile, standard Select on desktop.
 *
 * Props:
 *   value, onValueChange, placeholder, children (SelectItems), className, triggerClassName
 *   label — shown as the drawer header title
 */
export default function MobileSelect({ value, onValueChange, placeholder, label, children, triggerClassName }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Collect options from children for the drawer list
  const options = [];
  const processChildren = (ch) => {
    if (!ch) return;
    const arr = Array.isArray(ch) ? ch : [ch];
    arr.forEach((child) => {
      if (!child || !child.props) return;
      if (child.type && child.type.displayName === "SelectItem") {
        options.push({ value: child.props.value, label: child.props.children });
      } else if (child.props.children) {
        processChildren(child.props.children);
      }
    });
  };
  processChildren(children);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm text-left select-none",
          !selectedLabel && "text-muted-foreground",
          triggerClassName
        )}
      >
        <span className="truncate">{selectedLabel || placeholder || "Select..."}</span>
        <svg className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[70vh]">
          {label && (
            <DrawerHeader>
              <DrawerTitle>{label}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onValueChange(opt.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center px-6 py-4 text-sm font-medium border-b border-border last:border-0 select-none active:bg-muted transition-colors",
                  opt.value === value ? "text-primary bg-primary/5" : "text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}