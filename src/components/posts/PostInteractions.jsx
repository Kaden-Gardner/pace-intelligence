import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Heart, MessageCircle, Send, Trash2 } from "lucide-react";

function commentTimeAgo(iso) {
  if (!iso) return "";
  const now = new Date();
  const d = new Date(iso);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PostInteractions({ postId, initialLikes = [], initialComments = [] }) {
  const { user } = useAuth();
  const [likes, setLikes] = useState(initialLikes);
  const [comments, setComments] = useState(initialComments);
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let unsubLikes, unsubComments;
    (async () => {
      unsubLikes = base44.entities.PostLike.subscribe((event) => {
        setLikes((prev) => {
          if (event.type === "delete") return prev.filter((x) => x.id !== event.id);
          if (event.type === "create") {
            if (event.data.post_id !== postId) return prev;
            if (prev.some((x) => x.id === event.data.id)) return prev;
            const hasOptimistic = prev.some((x) => x.user_id === event.data.user_id && !x.id);
            if (hasOptimistic) {
              return prev.map((x) => (x.user_id === event.data.user_id && !x.id ? event.data : x));
            }
            return [...prev, event.data];
          }
          if (event.type === "update") return prev.map((x) => (x.id === event.data.id ? event.data : x));
          return prev;
        });
      });

      unsubComments = base44.entities.PostComment.subscribe((event) => {
        setComments((prev) => {
          if (event.type === "delete") return prev.filter((x) => x.id !== event.id);
          if (event.type === "create") {
            if (event.data.post_id !== postId) return prev;
            if (prev.some((x) => x.id === event.data.id)) return prev;
            const hasOptimistic = prev.some((x) => x.user_id === event.data.user_id && x.body === event.data.body && !x.id);
            if (hasOptimistic) {
              return prev.map((x) => (x.user_id === event.data.user_id && x.body === event.data.body && !x.id ? event.data : x));
            }
            return [...prev, event.data];
          }
          if (event.type === "update") return prev.map((x) => (x.id === event.data.id ? event.data : x));
          return prev;
        });
      });
    })();
    return () => {
      if (unsubLikes) unsubLikes();
      if (unsubComments) unsubComments();
    };
  }, [postId]);

  const hasLiked = likes.some((l) => l.user_id === user?.id);

  async function toggleLike() {
    if (!user) return;
    if (hasLiked) {
      const existing = likes.find((l) => l.user_id === user.id);
      if (!existing) return;
      setLikes((prev) => prev.filter((l) => l.id !== existing.id));
      try {
        await base44.entities.PostLike.delete(existing.id);
      } catch (e) {
        setLikes((prev) => [...prev, existing]);
      }
    } else {
      const userName = user.full_name || "User";
      setLikes((prev) => [...prev, { post_id: postId, user_id: user.id, user_name: userName }]);
      try {
        await base44.entities.PostLike.create({ post_id: postId, user_id: user.id, user_name: userName });
      } catch (e) {
        setLikes((prev) => prev.filter((l) => !(l.user_id === user.id && !l.id)));
      }
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentBody.trim() || submitting) return;
    setSubmitting(true);
    const text = commentBody.trim();
    const userName = user.full_name || "User";
    setComments((prev) => [...prev, { post_id: postId, user_id: user.id, user_name: userName, body: text }]);
    setCommentBody("");
    try {
      await base44.entities.PostComment.create({ post_id: postId, user_id: user.id, user_name: userName, body: text });
    } catch (e) {
      setComments((prev) => prev.filter((c) => !(c.body === text && c.user_id === user.id && !c.id)));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteComment(commentId) {
    const existing = comments.find((c) => c.id === commentId);
    if (!existing) return;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await base44.entities.PostComment.delete(commentId);
    } catch (e) {
      setComments((prev) => [...prev, existing]);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-1">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${hasLiked ? "text-red-500 bg-red-50 dark:bg-red-900/20" : "text-muted-foreground hover:bg-muted"}`}
        >
          <Heart className={`w-4 h-4 ${hasLiked ? "fill-current" : ""}`} />
          {likes.length > 0 && <span>{likes.length}</span>}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${showComments ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
        >
          <MessageCircle className="w-4 h-4" />
          {comments.length > 0 && <span>{comments.length}</span>}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 space-y-3">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id || `${c.user_id}-${c.body}`} className="flex items-start gap-2.5 bg-muted/50 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                    {(c.user_name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{c.user_name}</span>
                      <span className="text-[10px] text-muted-foreground">{commentTimeAgo(c.created_date)}</span>
                    </div>
                    <p className="text-sm leading-snug break-words">{c.body}</p>
                  </div>
                  {(c.user_id === user?.id || user?.role === "admin") && c.id && (
                    <button onClick={() => deleteComment(c.id)} className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={submitComment} className="flex gap-2">
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 h-9 rounded-full border border-input bg-transparent px-4 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button type="submit" disabled={!commentBody.trim() || submitting} className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}