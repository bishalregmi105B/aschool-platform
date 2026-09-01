"use client";

/**
 * Review tab — proofing (live word/char/paragraph counts), find & replace,
 * spelling toggle and the DOCX/PDF export shortcuts.
 */
import React from "react";
import {
  SpellCheck, Search, FileText, FileOutput, Loader2, Printer, Replace,
  MessageSquarePlus, GitCompareArrows, CheckCheck, XSquare,
} from "lucide-react";
import { RibbonGroup, RBtn, BtnCol } from "@/components/writer/ribbon";
import type { WriterCtx } from "@/components/writer/context";
import { Button } from "@/components/ui/button";

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[52px] w-[56px] rounded hover:bg-slate-100">
      <span className="text-base font-semibold text-slate-800 leading-none">{n}</span>
      <span className="text-[9px] text-slate-500 mt-0.5">{label}</span>
    </div>
  );
}

export function ReviewTab({ ctx }: { ctx: WriterCtx }) {
  const { editor, counts } = ctx;
  return (
    <>
      {/* Comments & tracked changes */}
      <RibbonGroup label="Comments & Tracking">
        <div className="flex flex-col gap-0.5 justify-center">
          <RBtn
            icon={<GitCompareArrows className="h-4 w-4" />}
            label={ctx.trackChanges ? "Tracking On" : "Track Changes"}
            title="Record insertions and deletions (Word-like)"
            wide
            active={ctx.trackChanges}
            onClick={ctx.toggleTrackChanges}
          />
          <RBtn icon={<MessageSquarePlus className="h-4 w-4" />} label="New Comment" title="Comment on the selection" onClick={ctx.addCommentOnSelection} />
        </div>
        <BtnCol>
          <RBtn icon={<CheckCheck className="h-4 w-4" />} label="Accept all" title="Accept all tracked changes" onClick={ctx.acceptAllChanges} />
          <RBtn icon={<XSquare className="h-4 w-4" />} label="Reject all" title="Reject all tracked changes" onClick={ctx.rejectAllChanges} />
        </BtnCol>
      </RibbonGroup>

      {/* Proofing */}
      <RibbonGroup label="Proofing">
        <div className="flex">
          <Stat n={counts.words} label="Words" />
          <Stat n={counts.chars} label="Characters" />
          <Stat n={counts.paras} label="Paragraphs" />
          <Stat n={`${counts.page}/${counts.pages}`} label="Page" />
        </div>
      </RibbonGroup>

      {/* Speech/Editing shared */}
      <RibbonGroup label="Editing">
        <BtnCol>
          <RBtn icon={<Search className="h-4 w-4" />} label="Find" title="Find (Ctrl+F)" onClick={() => ctx.openFindReplace(false)} />
          <RBtn icon={<Replace className="h-4 w-4" />} label="Replace" title="Find & replace" onClick={() => ctx.openFindReplace(true)} />
        </BtnCol>
        <RBtn
          icon={<SpellCheck className="h-4 w-4" />}
          label={ctx.spellCheck ? "Spelling On" : "Spelling Off"}
          title="Toggle browser spell-check"
          wide
          active={ctx.spellCheck}
          onClick={ctx.toggleSpellCheck}
        />
      </RibbonGroup>

      {/* Export */}
      <RibbonGroup label="Share">
        <div className="flex flex-col gap-0.5 justify-center">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 justify-start" onClick={ctx.exportDocx} disabled={ctx.exporting}>
            {ctx.exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Word Document (.docx)
          </Button>
          <div className="flex gap-1">
            <RBtn icon={<FileOutput className="h-4 w-4" />} title="PDF (server render)" onClick={() => ctx.exportPdf?.()} />
            <RBtn icon={<Printer className="h-4 w-4" />} title="Print" onClick={() => window.print()} />
          </div>
        </div>
      </RibbonGroup>
    </>
  );
}
