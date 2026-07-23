const BLOG_API_URL = 'https://content.schoolerventures.com/wp-json/wp/v2/posts?per_page=6';

function stripHtml(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  return (doc.body.textContent || '').trim();
}

function toContentDomain(link) {
  try {
    const url = new URL(link);
    url.protocol = 'https:';
    url.host = 'content.schoolerventures.com';
    return url.toString();
  } catch (error) {
    return link || '#';
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (isNaN(date)) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderPost(post) {
  const article = document.createElement('article');
  article.className = 'blog-post';

  const heading = document.createElement('h3');
  const link = document.createElement('a');
  link.href = toContentDomain(post.link);
  link.textContent = stripHtml(post.title && post.title.rendered) || 'Untitled';
  heading.appendChild(link);

  const date = document.createElement('p');
  date.className = 'blog-date';
  date.textContent = formatDate(post.date);

  const excerpt = document.createElement('p');
  excerpt.className = 'blog-excerpt';
  excerpt.textContent = stripHtml(post.excerpt && post.excerpt.rendered);

  article.append(heading, date, excerpt);
  return article;
}

function showMessage(container, text) {
  container.textContent = '';
  const message = document.createElement('p');
  message.className = 'blog-message';
  message.textContent = text;
  container.appendChild(message);
}

async function loadBlogPosts() {
  const container = document.getElementById('blog-posts');
  if (!container) return;

  try {
    const response = await fetch(BLOG_API_URL);
    if (!response.ok) throw new Error('Request failed with status ' + response.status);

    const posts = await response.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      showMessage(container, "No posts yet — check back soon.");
      return;
    }

    container.textContent = '';
    posts.forEach(post => container.appendChild(renderPost(post)));
  } catch (error) {
    showMessage(container, "Unable to load posts right now. Please check back later.");
  }
}

loadBlogPosts();
