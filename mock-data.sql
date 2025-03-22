-- DELETE existing data to prevent duplicate inserts
TRUNCATE TABLE public.like RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.comment RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.share RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.media RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.post RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.category RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.user RESTART IDENTITY CASCADE;

-- Insert Users
INSERT INTO public.user (username, email, password_hash, full_name, profile_picture_url, bio)
VALUES
('alice', 'alice@example.com', 'hashed_password_1', 'Alice Johnson', 'https://example.com/alice.jpg', 'Software Engineer'),
('bob', 'bob@example.com', 'hashed_password_2', 'Bob Smith', 'https://example.com/bob.jpg', 'Tech Enthusiast');

-- Insert Posts
INSERT INTO public.post (user_id, title, description, is_published, is_private, group_id, share_count, comment_count)
VALUES
(1, 'First Post', 'This is my first post!', true, false, NULL, 10, 5),
(2, 'Exploring Prisma', 'How to use Prisma with NestJS', true, false, NULL, 8, 3);

-- Insert Categories
INSERT INTO public.category (cate_name)
VALUES
('Tech'),
('Programming'),
('Lifestyle');

-- Insert Media
INSERT INTO public.media (post_id, media_type, description, url, creator_id, downloads)
VALUES
(1, 'image', 'A cool image', 'https://example.com/media1.jpg', 1, 100),
(2, 'video', 'A tutorial video', 'https://example.com/video.mp4', 2, 200);

-- Insert Likes
INSERT INTO public."like" (user_id, target_id, target_type)
VALUES
(1, 1, 'POST'),
(2, 1, 'POST'),
(1, 2, 'POST');

-- Insert Comments
INSERT INTO public.comment (user_id, parent_comment_id, target_id, target_type, content)
VALUES
(1, NULL, 1, 'POST', 'Great post!'),
(2, NULL, 1, 'POST', 'Very helpful, thanks!'),
(1, 1, 1, 'POST', 'Glad you liked it!'); -- Reply to comment 1

-- Insert Shares
INSERT INTO public.share (user_id, target_id, target_type, share_platform)
VALUES
(1, 1, 'POST', 'FACEBOOK'),
(2, 2, 'POST', 'TWITTER');
