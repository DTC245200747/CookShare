export type Recipe = {
  id: number;
  title: string;
  description: string;
  image_url: string | null;
  category_id: number;
  category_name: string;
  author_name: string;
  author_avatar?: string;
  author_id: number;
  prep_minutes: number;
  cook_minutes: number;
  servings: number;
  difficulty: string;
  status?: string;
  favorite_count: number;
  average_rating: number;
  rating_count: number;
  ingredients?: {
    ingredient_id: number;
    name: string;
    quantity: number;
    unit: string;
  }[];
  steps?: { position: number; instruction: string }[];
};
export type Category = { id: number; name: string };
export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  bio?: string;
  avatar_url?: string | null;
};
export type Page<T> = {
  data: T[];
  pagination: { page: number; limit: number; total: number };
};
