-- DELETE existing data to prevent duplicate inserts
TRUNCATE TABLE public.like RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.comment RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.share RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.media RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.post RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.category RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.user RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.follow RESTART IDENTITY CASCADE;

-- Insert Users
INSERT INTO public.user (id, username, email, full_name, profile_picture_url, bio)
VALUES
  ('bBc8jNEuqoZZdXPIGJEQ92HyaJb2', 'kiet', 'kietnguyentuan911@gmail.com', 'Alice Johnson', 'https://example.com/alice.jpg', 'Software Engineer'),
  ('2', 'bob', 'bob@example.com', 'Bob Smith', 'https://example.com/bob.jpg', 'Tech Enthusiast');

-- Insert Role
INSERT INTO public.role (role_name)
VALUES 
  ('ADMIN'),
  ('USER')

-- Insert User_Role
INSERT INTO public.user_role (user_id, role_id)
VALUES 
  (1, 1),
  (2, 2)

-- Insert Categories
INSERT INTO public.category (id, cate_name)
VALUES
  (1, 'Tech'),
  (2, 'Programming'),
  (3, 'Lifestyle');

