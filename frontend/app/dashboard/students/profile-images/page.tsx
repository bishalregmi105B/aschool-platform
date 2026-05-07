"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Image as ImageIcon, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudentProfileImagesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ImageIcon className="h-6 w-6" /> Student Profile Images
        </h1>
        <p className="text-muted-foreground">Bulk upload and manage student display pictures</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Image Upload</CardTitle>
          <CardDescription>Upload a zip file containing student images named by their Admission Number (e.g., ADM1023.jpg)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer">
            <UploadCloud className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">Drag and drop a .zip file</h3>
            <p className="text-sm text-muted-foreground mb-4">or click to browse from your computer</p>
            <Button>Select ZIP Archive</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
