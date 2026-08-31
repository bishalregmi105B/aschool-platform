"use client";

/**
 * ElementToolbar — left sidebar for adding elements to the canvas.
 * Sections: Text | Shapes | Media | Arrange
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePicker } from "@/components/files/FilePicker";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Type, Heading1, Heading2, Heading3, Square, Circle, Triangle,
  Minus, ImagePlus, Link2, Trash2, Copy, BringToFront, SendToBack,
  AlignCenterHorizontal, AlignCenterVertical, FlipHorizontal, FlipVertical,
  ArrowRight, Layers, Ungroup, Frame,
} from "lucide-react";

interface Props { canvas: any; }

const EXTRA_SHAPES = [
  { label: "Pentagon",  icon: "⬠", action: (c: any) => c.addPolygon(5) },
  { label: "Hexagon",   icon: "⬡", action: (c: any) => c.addPolygon(6) },
  { label: "Octagon",   icon: "⬣", action: (c: any) => c.addPolygon(8) },
  { label: "Star 5pt",  icon: "★", action: (c: any) => c.addStar(5) },
  { label: "Star 4pt",  icon: "✦", action: (c: any) => c.addStar(4) },
  { label: "Star 6pt",  icon: "✶", action: (c: any) => c.addStar(6) },
  { label: "Arrow →",   icon: "➡", action: (c: any) => c.addArrow() },
];

/** Canva-style image frames (canvas.addFrame clips a dropped photo to the shape) */
const FRAMES = [
  { label: "Rounded Frame", icon: "▢", kind: "rounded" as const },
  { label: "Circle Frame",  icon: "●", kind: "circle" as const },
  { label: "Star Frame",    icon: "★", kind: "star" as const },
  { label: "Blob Frame",    icon: "◍", kind: "blob" as const },
];

function ToolBtn({ icon: Icon, label, action, danger = false }: {
  icon?: React.ElementType; iconChar?: string; label: string; action: () => void; danger?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 ${danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-primary/10 hover:text-primary"}`}
          onClick={action}
        >
          {Icon ? <Icon className="h-4 w-4" /> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function Section({ label }: { label: string }) {
  return (
    <p className="text-[9px] text-muted-foreground uppercase tracking-wide w-full text-center pt-0.5 select-none">
      {label}
    </p>
  );
}

export default function ElementToolbar({ canvas }: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [imgOpen, setImgOpen] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);

  return (
    <div className="w-14 border-r bg-background flex flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto">
      <FilePicker
        open={showImagePicker}
        onOpenChange={setShowImagePicker}
        fileType="image"
        title="Select Image"
        onSelect={(files) => {
          const selected = files[0];
          if (selected?.url) {
            canvas.addImage(selected.url);
          }
        }}
      />

      {/* ── Text ─────────────────────────────────── */}
      <Section label="Text" />
      <ToolBtn icon={Heading1} label="Heading 1" action={() => canvas.addHeading(1)} />
      <ToolBtn icon={Heading2} label="Heading 2" action={() => canvas.addHeading(2)} />
      <ToolBtn icon={Heading3} label="Heading 3" action={() => canvas.addHeading(3)} />
      <ToolBtn icon={Type}     label="Body Text"  action={() => canvas.addText()} />

      <Separator className="my-1 w-8" />

      {/* ── Shapes ───────────────────────────────── */}
      <Section label="Shapes" />
      <ToolBtn icon={Square}   label="Rectangle"    action={() => canvas.addRect()} />
      <ToolBtn icon={Circle}   label="Circle"       action={() => canvas.addCircle()} />
      <ToolBtn icon={Triangle} label="Triangle"     action={() => canvas.addTriangle()} />
      <ToolBtn icon={Minus}    label="Line"         action={() => canvas.addLine()} />
      <ToolBtn icon={ArrowRight} label="Arrow"      action={() => canvas.addArrow()} />

      {/* More shapes popover */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary text-base leading-none">
                ⬡
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">More Shapes</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" className="w-44 p-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">More Shapes</p>
          <div className="grid grid-cols-3 gap-1">
            {EXTRA_SHAPES.map(({ label, icon, action }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 w-full text-xl" onClick={() => action(canvas)}>
                    {icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Frames popover (Canva-style image frames) */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary">
                <Frame className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Image Frames</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" className="w-44 p-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Image Frames</p>
          <div className="grid grid-cols-4 gap-1">
            {FRAMES.map(({ label, icon, kind }) => (
              <Tooltip key={kind}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-10 w-full text-xl" onClick={() => canvas.addFrame(kind)}>
                    {icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Drop an image over a frame to clip it into the shape.
          </p>
        </PopoverContent>
      </Popover>

      <Separator className="my-1 w-8" />

      {/* ── Media ────────────────────────────────── */}
      <Section label="Media" />
      <ToolBtn icon={ImagePlus} label="Upload Image" action={() => setShowImagePicker(true)} />

      {/* Image by URL */}
      <Popover open={imgOpen} onOpenChange={setImgOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-primary/10 hover:text-primary">
                <Link2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Image URL</TooltipContent>
        </Tooltip>
        <PopoverContent side="right" className="w-64 p-3">
          <p className="text-xs font-semibold mb-2">Add Image from URL</p>
          <Input
            placeholder="https://example.com/image.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && urlInput.trim()) {
                canvas.addImage(urlInput.trim()); setUrlInput(""); setImgOpen(false);
              }
            }}
            className="h-7 text-xs mb-2"
          />
          <Button size="sm" className="w-full h-7 text-xs" onClick={() => {
            if (urlInput.trim()) { canvas.addImage(urlInput.trim()); setUrlInput(""); setImgOpen(false); }
          }}>
            Add Image
          </Button>
          <p className="text-[10px] text-muted-foreground mt-2">Tip: Use Unsplash, Pexels or direct image URLs</p>
        </PopoverContent>
      </Popover>

      <Separator className="my-1 w-8" />

      {/* ── Edit ─────────────────────────────────── */}
      <Section label="Edit" />
      <ToolBtn icon={Copy}  label="Duplicate"  action={() => canvas.duplicateSelected()} />
      <ToolBtn icon={Trash2} label="Delete"    action={() => canvas.deleteSelected()} danger />

      <Separator className="my-1 w-8" />

      {/* ── Order ────────────────────────────────── */}
      <Section label="Order" />
      <ToolBtn icon={BringToFront} label="Bring to Front" action={() => canvas.bringToFront()} />
      <ToolBtn icon={SendToBack}   label="Send to Back"   action={() => canvas.sendToBack()} />
      <ToolBtn icon={Layers}       label="Group"          action={() => canvas.groupSelected()} />
      <ToolBtn icon={Ungroup}      label="Ungroup"        action={() => canvas.ungroupSelected()} />

      <Separator className="my-1 w-8" />

      {/* ── Align ────────────────────────────────── */}
      <Section label="Align" />
      <ToolBtn icon={AlignCenterHorizontal} label="Center Horizontally" action={() => canvas.alignCenter()} />
      <ToolBtn icon={AlignCenterVertical}   label="Center Vertically"   action={() => canvas.alignMiddle()} />
      <ToolBtn icon={FlipHorizontal}        label="Flip Horizontal"     action={() => canvas.flipHorizontal()} />
      <ToolBtn icon={FlipVertical}          label="Flip Vertical"       action={() => canvas.flipVertical()} />
    </div>
  );
}
