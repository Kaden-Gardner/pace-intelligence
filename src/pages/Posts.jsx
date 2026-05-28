import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pin, Camera, Plus, X, Check, Trash2, Image, CalendarClock } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PullToRefresh from "@/components/PullToRefresh";

function ShiftPostCard({ post }) {
  let data;
  try { data = JSON.parse(post.body); } catch { return null; }
  const dateLabel = post.title.replace("__SHIFT_POST__", "");

  return (
    <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl border border-primary/20 p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <CalendarClock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-heading font-bold text-base">{dateLabel}</p>
          <p className="text-xs text-muted-foreground">
            Today's Shift{data.shift_time ? ` · Start: ${data.shift_time}` : ""} · Pace Bars
          </p>
        </div>
      </div>

      {/* Flavorset */}
      {data.flavorset_name && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            {data.flavorset_color && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: data.flavorset_color }} />}
            <p className="font-heading font-semibold text-lg">{data.flavorset_name}</p>
          </div>
          {data.flavor_names && data.flavor_names.length > 0 && (
            <div className="flex flex-wrap gap-2 ml-5">
              {data.flavor_names.map((name, i) => {
                const color = data.flavor_colors?.[i];
                return (
                  <span key={i} className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-muted font-medium border border-border">
                    {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
                    {name}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Special Order */}
      {data.special_order && data.special_order_name && (
        <div className="mb-3">
          <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">🟢 Special Order: {data.special_order_name}</span>
        </div>
      )}

      {/* Mixer */}
      {data.mixer && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">🥄 Mixer</p>
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-blue-100 text-blue-800 rounded-full font-medium">
            {data.mixer.name}
            {data.mixer.age === 14 && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">14</span>}
          </span>
        </div>
      )}

      {/* Working employees */}
      {data.working_employees && data.working_employees.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">👥 Working Today</p>
          <div className="flex flex-wrap gap-2">
            {data.working_employees.map((emp) => (
              <span key={emp.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-primary/10 text-primary rounded-full font-medium">
                {emp.name}
                {emp.age === 14 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">14</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {data.notes && <p className="text-xs text-muted-foreground mt-3 italic">📝 {data.notes}</p>}
    </div>
  );
}

function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr + "T12:00:00");
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Posts() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const all = await base44.entities.Post.list("-post_date", 100);
    // Pinned posts first, then by date
    const sorted = [
      ...all.filter((p) => p.is_pinned),
      ...all.filter((p) => !p.is_pinned),
    ];
    setPosts(sorted);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    let photo_url = null;

    if (photoFile) {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: photoFile });
      photo_url = file_url;
      setUploading(false);
    }

    const today = new Date().toISOString().split("T")[0];
    const newPost = await base44.entities.Post.create({
      title: title.trim() || null,
      body: body.trim(),
      photo_url,
      is_pinned: false,
      is_birthday: false,
      post_date: today,
      author_name: user?.full_name || "Admin",
    });

    // Send email notification to all active employees
    base44.functions.invoke("newPostNotify", { post_id: newPost.id, post_body: body.trim(), post_title: title.trim() || null, author_name: newPost.author_name });

    setPosts((prev) => [newPost, ...prev]);
    setBody("");
    setTitle("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setShowForm(false);
    setSaving(false);
  }

  async function deletePost(id) {
    await base44.entities.Post.delete(id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function togglePin(post) {
    await base44.entities.Post.update(post.id, { is_pinned: !post.is_pinned });
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, is_pinned: !p.is_pinned } : p))
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <PullToRefresh onRefresh={load}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-3xl font-bold">Posts</h1>
            <p className="text-muted-foreground mt-1">Updates and announcements from the team</p>
          </div>
          {isAdmin && !showForm && (
            <Button className="gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> New Post
            </Button>
          )}
        </div>

        {/* Post creation form */}
        {isAdmin && showForm && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="font-heading font-semibold mb-4">New Post</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="Title (optional)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <Textarea
                  placeholder="What's the update?"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Camera className="w-4 h-4" />
                  <span>Add a photo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
                {photoPreview && (
                  <div className="mt-3 relative inline-block">
                    <img src={photoPreview} alt="Preview" className="max-h-48 rounded-xl border border-border object-cover" />
                    <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !body.trim()} className="gap-2">
                  <Check className="w-4 h-4" />
                  {uploading ? "Uploading..." : saving ? "Posting..." : "Post"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setBody(""); setTitle(""); setPhotoFile(null); setPhotoPreview(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Posts feed */}
        {posts.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Image className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">No posts yet</p>
            <p className="text-sm">Check back soon for updates from the team.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const isShiftPost = post.title && post.title.startsWith("__SHIFT_POST__");
              return (
              <div key={post.id} className={`bg-card rounded-2xl border p-5 ${post.is_pinned ? "border-primary" : "border-border"} ${post.is_birthday ? "bg-gradient-to-br from-yellow-50/50 to-pink-50/50 dark:from-yellow-900/10 dark:to-pink-900/10" : ""}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {post.is_pinned && (
                      <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    )}
                    {post.is_birthday && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        🎂 Birthday
                      </span>
                    )}
                    {!isShiftPost && post.author_name && (
                      <span className="text-xs text-muted-foreground font-medium">{post.author_name}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(post.post_date)}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => togglePin(post)}
                        title={post.is_pinned ? "Unpin" : "Pin to top"}
                        className={`p-1.5 rounded-lg transition-colors ${post.is_pinned ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-primary hover:bg-muted"}`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Post</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove this post from the feed.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePost(post.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {/* Shift post rich content or regular content */}
                {isShiftPost ? (
                  <ShiftPostCard post={post} />
                ) : (
                  <>
                    {post.title && (
                      <h3 className="font-heading font-semibold text-lg mb-2">{post.title}</h3>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>
                    {post.photo_url && (
                      <div className="mt-4">
                        <img src={post.photo_url} alt="Post" className="w-full max-h-96 object-cover rounded-xl border border-border" />
                      </div>
                    )}
                  </>
                )}
              </div>
            );})}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}