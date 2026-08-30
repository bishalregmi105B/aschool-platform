"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { api, type ApiResponse } from "@/lib/api";
import { PluginGate } from "@/lib/plugins";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import { Heart, MessageCircle, Send, Users, Trash2 } from "lucide-react";
import { displayBS } from "@/lib/nepali_date";
import { useAuth } from "@/lib/auth-context";

interface Comment {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
}

interface Post {
  id: string;
  author_id: string;
  author_name?: string | null;
  content: string;
  post_type: string;
  media_urls: string[];
  likes_count: number;
  comments_count?: number;
  visibility: string;
  created_at: string;
}

export default function SocialHubPage() {
  return (
    <PluginGate slug="social_hub">
      <SocialHubContent />
    </PluginGate>
  );
}

function PostComments({ postId }: { postId: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: comments } = useQuery({
    queryKey: ["social-comments", postId],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(`/social/posts/${postId}/comments`);
      return (res.data.data as Comment[]) || [];
    },
    enabled: open,
  });

  const commentMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse>(`/social/posts/${postId}/comments`, { content: text });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      setText("");
      toast.success("Comment posted!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to post comment"),
  });

  return (
    <div className="mt-2">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        <MessageCircle className="h-4 w-4 mr-1" /> {open ? "Hide" : "Comments"}
      </Button>
      {open && (
        <div className="mt-2 space-y-2 pl-2 border-l-2">
          {comments?.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar name="User" size="sm" className="h-6 w-6 text-[10px]" />
              <div>
                <p className="text-sm">{c.content}</p>
                <span className="text-xs text-muted-foreground">
                  {displayBS(c.created_at)}
                </span>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="Write a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && text.trim()) commentMut.mutate();
              }}
            />
            <Button size="sm" className="h-8" disabled={!text.trim() || commentMut.isPending} onClick={() => commentMut.mutate()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SocialHubContent() {
  const [newPost, setNewPost] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // matches the backend's delete_post authorization (author OR
  // superadmin/school_admin) — teachers who are not the author get a 403,
  // so the moderation button must not be offered to them (E132)
  const canModerate =
    user?.role === "school_admin" ||
    user?.role === "superadmin" ||
    user?.role === "teacher";
  const canDeletePost = (post: Post) =>
    user?.role === "school_admin" ||
    user?.role === "superadmin" ||
    (user?.id != null && user.id === post.author_id);

  const { data: posts, isLoading, isError, refetch } = useQuery({
    queryKey: ["social-posts"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/social/posts");
      return (res.data.data as Post[]) || [];
    },
    retry: 1,
  });

  const { data: groups } = useQuery({
    queryKey: ["social-groups"],
    queryFn: async () => {
      const res = await api.get<ApiResponse>("/social/groups");
      return (res.data.data as Array<{ id: string; name: string; group_type: string }>) || [];
    },
  });

  const createPostMut = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse>("/social/posts", { content: newPost, type: "text" });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      setNewPost("");
      toast.success("Post shared!");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to share post"),
  });

  const likeMut = useMutation({
    mutationFn: async (postId: string) => {
      const res = await api.post<ApiResponse>(`/social/posts/${postId}/like`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-posts"] }),
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to update like"),
  });

  const deleteMut = useMutation({
    // moderation surface: DELETE /social/posts/<id> (backend enforces
    // author-or-admin; soft-delete keeps audit trail)
    mutationFn: async (postId: string) => (await api.delete(`/social/posts/${postId}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      toast.success("Post removed");
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || "Failed to remove post"),
  });

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="text-sm text-destructive">Failed to load the social feed. Please try again.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </CardContent></Card>
      </div>
    );
  }
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social Hub</h1>
        <p className="text-muted-foreground">School community feed, groups, and events</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* New Post */}
          <Card>
            <CardContent className="pt-6">
              <Textarea placeholder="Share something with your school community..." value={newPost} onChange={(e) => setNewPost(e.target.value)} rows={3} />
              <div className="flex justify-end mt-3">
                <Button onClick={() => createPostMut.mutate()} disabled={!newPost.trim() || createPostMut.isPending}>
                  <Send className="h-4 w-4 mr-2" /> {createPostMut.isPending ? "Posting..." : "Post"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Posts */}
          {posts?.map((post: any) => (
            <Card key={post.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Avatar name={post.author_name || "User"} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{post.author_name || "User"}</span>
                      <span className="text-xs text-muted-foreground">{displayBS(post.created_at)}</span>
                      <Badge variant="outline" className="text-xs">{post.visibility}</Badge>
                      {canModerate && canDeletePost(post) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-7 px-2 text-muted-foreground hover:text-destructive"
                          disabled={deleteMut.isPending}
                          title="Remove post (moderation)"
                          onClick={() => { if (confirm("Remove this post?")) deleteMut.mutate(post.id); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-sm">{post.content}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <Button variant="ghost" size="sm" onClick={() => likeMut.mutate(post.id)}>
                        <Heart className="h-4 w-4 mr-1" /> {post.likes_count}
                      </Button>
                    </div>
                    <PostComments postId={post.id} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm"><Users className="h-4 w-4 inline mr-2" />Groups</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {groups?.length === 0 && <p className="text-sm text-muted-foreground">No groups yet</p>}
              {groups?.map((group: any) => (
                <div key={group.id} className="flex items-center justify-between p-2 rounded hover:bg-muted">
                  <span className="text-sm font-medium">{group.name}</span>
                  <Badge variant="outline" className="text-xs">{group.group_type}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
