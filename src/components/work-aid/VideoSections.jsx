import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Film, GraduationCap } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const MAX_DURATION_SECONDS = 300; // 5 minutes

const VIDEO_TYPES = [
  { key: "in_action", label: "In Action Videos", icon: Film },
  { key: "training", label: "Training Videos", icon: GraduationCap },
];

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this video file."));
    };
    video.src = url;
  });
}

export default function VideoSections({ position }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsub;
    setLoading(true);
    (async () => {
      try {
        const list = await base44.entities.WorkAidVideo.filter({ position });
        setVideos(list);
      } catch (err) {
        console.error("Failed to load videos:", err);
      } finally {
        setLoading(false);
      }
      unsub = base44.entities.WorkAidVideo.subscribe((event) => {
        setVideos((prev) => {
          if (event.type === "delete") return prev.filter((v) => v.id !== event.id);
          if (event.type === "create") {
            if (event.data?.position === position) return [...prev, event.data];
            return prev;
          }
          if (event.type === "update") {
            return prev.map((v) => (v.id === event.data.id ? event.data : v));
          }
          return prev;
        });
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [position]);

  async function handleUpload(e, videoType) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploadingType(videoType);
    try {
      const duration = await getVideoDuration(file);
      if (!isFinite(duration) || duration > MAX_DURATION_SECONDS) {
        setError("Video must be 5 minutes or shorter.");
        return;
      }
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.WorkAidVideo.create({
        position,
        video_type: videoType,
        video_url: file_url,
        duration_seconds: Math.round(duration),
      });
    } catch (err) {
      setError(err.message || "Failed to upload video.");
    } finally {
      setUploadingType(null);
    }
  }

  async function handleDelete(id) {
    try {
      await base44.entities.WorkAidVideo.delete(id);
    } catch (err) {
      console.error("Failed to delete video:", err);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {VIDEO_TYPES.map((vt) => {
        const sectionVideos = videos.filter((v) => v.video_type === vt.key);
        const Icon = vt.icon;
        return (
          <div key={vt.key} className="bg-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                <Icon className="w-4 h-4" /> {vt.label}
              </h3>
              {isAdmin && (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleUpload(e, vt.key)}
                      disabled={uploadingType !== null}
                    />
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingType === vt.key ? "Uploading..." : "Upload"}
                  </label>
                </Button>
              )}
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : sectionVideos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No {vt.label.toLowerCase()} yet.
              </p>
            ) : (
              <div className="space-y-3">
                {sectionVideos.map((v) => (
                  <div key={v.id} className="relative rounded-xl overflow-hidden border border-border bg-black">
                    <video src={v.video_url} controls className="w-full max-h-80" />
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Video</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove this video from this section.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(v.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  );
}