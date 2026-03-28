import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, FileImage, Loader2 } from "lucide-react";

export interface MaterialItem {
  materialType: string;
  imageUrl: string;
  fileName: string;
  fileSize: number;
  previewUrl?: string;
}

interface CertificationUploadZoneProps {
  materials: MaterialItem[];
  onMaterialsChange: (materials: MaterialItem[]) => void;
  disabled?: boolean;
}

const MATERIAL_TYPES: Record<string, string> = {
  student_card: "学生证",
  degree_cert: "学位证书",
  xuexin_screenshot: "学信网截图",
  other: "其他材料",
};

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function CertificationUploadZone({ materials, onMaterialsChange, disabled }: CertificationUploadZoneProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingType, setUploadingType] = useState("student_card");

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/certification", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "上传失败");
      }
      return res.json();
    },
    onError: (err: any) => {
      toast({ title: err.message || "上传失败", variant: "destructive" });
    },
  });

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (materials.length + fileList.length > MAX_FILES) {
      toast({ title: `最多上传${MAX_FILES}个文件`, variant: "destructive" });
      return;
    }

    for (const file of fileList) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ title: `${file.name} 格式不支持，请上传 JPG/PNG/WebP`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast({ title: `${file.name} 超过10MB限制`, variant: "destructive" });
        continue;
      }

      try {
        const result = await uploadMutation.mutateAsync(file);
        const previewUrl = URL.createObjectURL(file);
        const newItem: MaterialItem = {
          materialType: uploadingType,
          imageUrl: result.url,
          fileName: file.name,
          fileSize: file.size,
          previewUrl,
        };
        onMaterialsChange([...materials, newItem]);
      } catch {
        // error handled in mutation
      }
    }
  }, [materials, onMaterialsChange, uploadingType, uploadMutation, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }, [handleFiles, disabled]);

  const removeMaterial = (idx: number) => {
    const updated = [...materials];
    if (updated[idx].previewUrl) URL.revokeObjectURL(updated[idx].previewUrl!);
    updated.splice(idx, 1);
    onMaterialsChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Material type selector */}
      <div>
        <label className="text-sm font-medium mb-1.5 block">材料类型</label>
        <Select value={uploadingType} onValueChange={setUploadingType} disabled={disabled}>
          <SelectTrigger data-testid="select-material-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MATERIAL_TYPES).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        data-testid="upload-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          disabled={disabled}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          data-testid="input-file-upload"
        />
        {uploadMutation.isPending ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 size={32} className="text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">上传中...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">点击或拖拽图片到此处上传</p>
            <p className="text-xs text-muted-foreground">支持 JPG/PNG/WebP，单个文件不超过 10MB</p>
          </div>
        )}
      </div>

      {/* Preview list */}
      {materials.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {materials.map((m, idx) => (
            <Card key={idx} className="p-3 flex gap-3 items-start" data-testid={`material-item-${idx}`}>
              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                <img
                  src={m.previewUrl || m.imageUrl}
                  alt={m.fileName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.fileName}</p>
                <p className="text-xs text-muted-foreground">{MATERIAL_TYPES[m.materialType] || m.materialType}</p>
                <p className="text-xs text-muted-foreground">{(m.fileSize / 1024).toFixed(0)} KB</p>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMaterial(idx)}
                  data-testid={`btn-remove-material-${idx}`}
                >
                  <X size={14} />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {materials.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          已选择 {materials.length}/{MAX_FILES} 个文件
        </p>
      )}
    </div>
  );
}
