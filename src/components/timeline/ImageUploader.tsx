import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ImageUploaderProps {
  optionId: string;
  currentCount: number;
  onUploaded: () => void;
}

const ImageUploader = ({ optionId, currentCount, onUploaded }: ImageUploaderProps) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${optionId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('trip-images')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('trip-images')
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from('option_images')
        .insert({
          option_id: optionId,
          image_url: urlData.publicUrl,
          sort_order: currentCount,
        });

      if (insertError) throw insertError;

      onUploaded();
      toast({ title: 'Image uploaded!' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs"
      >
        {uploading ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Camera className="mr-1 h-3 w-3" />
        )}
        Add Photo
      </Button>
    </>
  );
};

export default ImageUploader;
