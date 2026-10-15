import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Heart } from "lucide-react";
import { api } from "../services/api";
import type { Page, Recipe } from "../types";
export function ProfileCollections() {
  const [mine, setMine] = useState<Page<Recipe> | null>(null),
    [saved, setSaved] = useState<Page<Recipe> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      api<Page<Recipe>>("/me/recipes?limit=3"),
      api<Page<Recipe>>("/me/saved?limit=3"),
    ])
      .then(([m, s]) => {
        setMine(m);
        setSaved(s);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="profile-collections">
      {error && <p className="auth-error">{error}</p>}
      {[
        [mine, "Công thức đã đăng", "mine", BookOpen],
        [saved, "Công thức yêu thích", "favorites", Heart],
      ].map(([data, title, route, Icon]) => {
        const collection = data as Page<Recipe> | null,
          I = Icon as typeof Heart;
        return (
          <section className="panel" key={String(route)}>
            <div className="section-heading">
              <h3>
                <I size={17} /> {String(title)}{" "}
                <span>({collection?.pagination.total ?? 0})</span>
              </h3>
              <button
                aria-label={`Xem ${String(title)}`}
                onClick={() => (location.hash = String(route))}
              >
                <ArrowUpRight size={18} />
              </button>
            </div>
            {collection?.data.length ? (
              collection.data.map((r) => (
                <button
                  key={r.id}
                  className="mini-recipe"
                  onClick={() => (location.hash = `recipe/${r.id}`)}
                >
                  <img src={r.image_url || "/images/tacos.jpg"} alt={r.title} />
                  <span>
                    {r.title}
                    <small>
                      {r.prep_minutes + r.cook_minutes} phút · {r.category_name}
                    </small>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              ))
            ) : (
              <p className="muted">Chưa có công thức trong mục này.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
