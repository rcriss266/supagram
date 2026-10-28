"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTimeAgo } from "./utils/time";
import { type Post } from "./mocks/posts";
import { supabase } from "./utils/supabase";

type FeedPostRow = {
  id: number | string;
  user_id: string;
  image_url: string;
  caption: string | null;
  likes: number | null;
  created_at: string;
};
type LikeRow = { post_id: number | string };
type FeedProfileRow = { id: string; username: string | null; avatar_url: string | null };

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-7 h-7 text-red-500"
      >
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-7 h-7"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  );
}

function PostCard({
  post,
  onLike,
  onComment,
}: {
  post: Post;
  onLike: (id: number | string) => Promise<string | null>;
  onComment: (id: number | string, body: string) => Promise<boolean>;
}) {
  const [comment, setComment] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [likeMessage, setLikeMessage] = useState("");

  async function toggleLike() {
    setLikeMessage("");
    const message = await onLike(post.id);
    if (message) setLikeMessage(message);
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = comment.trim();
    if (!body || isSendingComment) return;
    setIsSendingComment(true);
    if (await onComment(post.id, body)) setComment("");
    setIsSendingComment(false);
  }

  return (
    <article className="bg-card-bg border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Header con usuario y avatar */}
      <div className="flex items-center gap-3 p-4">
        <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary">
          <Image
            src={post.user?.avatar || 'https://i.pravatar.cc/150?img=8'}
            alt={post.user?.username || 'default user'}
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{post.user?.username || 'usuario'}</span>
          <span className="text-xs text-foreground/50">{getTimeAgo(new Date(post.created_at))}</span>
        </div>
      </div>

      {/* Imagen del post */}
      <div className="relative w-full aspect-square">
        <Image
          src={post.image_url}
            alt={`Post de ${post.user?.username || 'usuario'}`}
          fill
          className="object-cover"
        />
      </div>

      {/* Acciones y caption */}
      <div className="p-4">
        {/* BotÃ³n de like con contador */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLike}
            className="hover:scale-110 transition-transform active:scale-95"
            aria-label={post.isLiked ? "Quitar like" : "Dar like"}
          >
            <HeartIcon filled={post.isLiked} />
          </button>
          <span className="font-semibold text-foreground">
            {post.likes.toLocaleString()} likes
          </span>
        </div>
        {likeMessage && <p role="status" className="mt-2 text-sm text-primary">{likeMessage} <a href="/auth/login" className="underline">Iniciar sesión</a></p>}

        {/* Caption */}
        <p className="mt-2 text-foreground">
          <span className="font-semibold">{post.user?.username || 'usuario'}</span>{" "}
          <span className="text-foreground/80">{post.caption}</span>
        </p>
        <form onSubmit={submitComment} className="mt-3 flex gap-2">
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Escribe un comentario..."
            maxLength={500}
            aria-label="Escribe un comentario"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={!comment.trim() || isSendingComment}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {isSendingComment ? "Enviando..." : "Comentar"}
          </button>
        </form>
      </div>
    </article>
  );
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    async function getPosts() {
      const { data: rows, error: postsError } = await supabase
        .from("posts")
        .select("id, user_id, image_url, caption, likes, created_at")
        .order("created_at", { ascending: false });

      if (postsError || !rows) {
        console.error("No se pudieron cargar las publicaciones:", postsError);
        return;
      }

      const typedRows = rows as FeedPostRow[];
      const userIds = [...new Set(typedRows.map((post) => post.user_id))];
      const { data: profiles, error: profilesError } = userIds.length
        ? await supabase.from("profiles").select("id, username, avatar_url").in("id", userIds)
        : { data: [], error: null };

      if (profilesError) {
        console.error("No se pudieron cargar los perfiles de las publicaciones:", profilesError);
      }

      const profileById = new Map(
        ((profiles || []) as FeedProfileRow[]).map((profile) => [profile.id, profile]),
      );
      const { data: { user } } = await supabase.auth.getUser();
      const { data: likes } = user
        ? await supabase.from("likes").select("post_id").eq("user_id", user.id)
        : { data: [] as LikeRow[] | null };
      const likedPostIds = new Set(((likes || []) as LikeRow[]).map((like) => String(like.post_id)));
      setPosts(typedRows.map((post) => {
        const profile = profileById.get(post.user_id);
        return {
          id: post.id,
          user: {
            username: profile?.username || "usuario",
            avatar: profile?.avatar_url || "https://i.pravatar.cc/150?img=8",
          },
          image_url: post.image_url,
          caption: post.caption || "",
          likes: post.likes || 0,
          isLiked: likedPostIds.has(String(post.id)),
          created_at: new Date(post.created_at),
        };
      }));
    }

    getPosts()
  }, [])

  //const [posts, setPosts] = useState<Post[]>(initialPosts);

  const handleLike = async (postId: number | string): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Inicia sesión para dar like.";
    const post = posts.find((item) => String(item.id) === String(postId));
    if (!post) return "No se encontró la publicación.";
    const wasLiked = post.isLiked;
    setPosts((prevPosts) =>
      prevPosts.map((post) =>
        String(post.id) === String(postId)
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );

    const result = wasLiked
      ? await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id)
      : await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
    if (result.error) {
      setPosts((prevPosts) => prevPosts.map((item) =>
        String(item.id) === String(postId)
          ? { ...item, isLiked: wasLiked, likes: item.likes + (wasLiked ? 1 : -1) }
          : item
      ));
      console.error("No se pudo actualizar el like:", result.error);
      return `No se pudo guardar el like: ${result.error.message}`;
    }
    return null;
  };

  const handleComment = async (postId: number | string, body: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // La columna de texto cambia entre esquemas: detecta la que exista en comments.
    for (const textColumn of ["body", "content", "comment", "comment_text", "text", "message"]) {
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: user.id,
        [textColumn]: body,
      });
      if (!error) return true;
      if (error.code !== "PGRST204" || !error.message.includes(`'${textColumn}'`)) {
        console.error("No se pudo guardar el comentario:", error);
        return false;
      }
    }

    console.error("No se encontró una columna de texto compatible en comments.");
    return false;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card-bg border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Supagram
          </h1>
        </div>
      </header>

      {/* Feed de posts */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} onComment={handleComment} />
          ))}
        </div>
      </main>
    </div>
  );
}


