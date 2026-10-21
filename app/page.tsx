type FeedText = {
  $t: string;
};

type FeedLink = {
  href: string;
  rel?: string;
};

type FeedImage = {
  url?: string;
};

type FeedEntry = {
  title?: FeedText;
  content?: FeedText;
  published?: FeedText;
  category?: FeedText[];
  link?: FeedLink[];
  media$thumbnail?: FeedImage;
};

type BooksFeed = {
  feed?: {
    entry?: FeedEntry[];
    "openSearch$totalResults"?: FeedText;
  };
};

type Book = {
  title: string;
  description: string;
  category: string;
  coverUrl?: string;
  downloadUrl?: string;
  publishedAt?: string;
};

const FEED_URL =
  "https://books.abdemustafa.com/feeds/posts/default?alt=json";

export const dynamic = "force-dynamic";

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripMarkup(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>|<\/div>|<\/h[1-6]>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getBook(entry: FeedEntry): Book | null {
  const title = entry.title?.$t?.trim();
  if (!title) return null;

  const content = entry.content?.$t ?? "";
  const links = [...content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const imageMatch = content.match(/<img\b[^>]*src=["']([^"']+)["']/i);
  const downloadLink = links.find(([, href, label]) => {
    const value = `${href} ${stripMarkup(label)}`.toLowerCase();
    return value.includes(".pdf") || value.includes("download") || value.includes("pdf");
  });
  const pageLink = entry.link?.find((link) => link.rel === "alternate")?.href;

  return {
    title,
    description: stripMarkup(content).slice(0, 180),
    category: entry.category?.[0]?.$t ?? "Books",
    coverUrl: imageMatch?.[1] ?? entry.media$thumbnail?.url,
    downloadUrl: downloadLink?.[1] ?? pageLink,
    publishedAt: entry.published?.$t,
  };
}

async function getBooks(): Promise<Book[]> {
  try {
    const pageSize = 150;
    const firstPageUrl = `${FEED_URL}&max-results=${pageSize}&start-index=1`;
    const response = await fetch(firstPageUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Books feed returned ${response.status}`);
    }

    const firstPage = (await response.json()) as BooksFeed;
    const totalResults = Number(firstPage.feed?.["openSearch$totalResults"]?.$t ?? 0);
    const pages = [firstPage];

    for (let startIndex = pageSize + 1; startIndex <= totalResults; startIndex += pageSize) {
      const pageResponse = await fetch(
        `${FEED_URL}&max-results=${pageSize}&start-index=${startIndex}`,
        { cache: "no-store" },
      );
      if (!pageResponse.ok) {
        throw new Error(`Books feed page returned ${pageResponse.status}`);
      }
      pages.push((await pageResponse.json()) as BooksFeed);
    }

    return pages
      .flatMap((page) => page.feed?.entry ?? [])
      .map(getBook)
      .filter((book): book is Book => book !== null);
  } catch (error) {
    console.error("Unable to load books feed", error);
    return [];
  }
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

function BookCover({ book }: { book: Book }) {
  if (book.coverUrl) {
    return (
      <div
        className="h-44 w-full bg-[var(--cover-placeholder)] bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundImage: `url("${book.coverUrl}")` }}
        role="img"
        aria-label={`Cover of ${book.title}`}
      />
    );
  }

  return (
    <div className="flex h-44 w-full items-center justify-center bg-[var(--cover-placeholder)] p-4 text-center">
      <span className="font-serif text-2xl font-bold text-[var(--ink)]">AMO</span>
    </div>
  );
}

export default async function Home() {
  const books = await getBooks();

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="mx-auto flex max-w-7xl items-end justify-between gap-6 px-5 py-8 sm:px-8 lg:px-10">
          <div>
            <div className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-[var(--amber-700)]">
              <span className="h-px w-8 bg-[var(--amber-500)]" />
              Abde Mustafa
            </div>
            <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">
              Books Library
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)] sm:text-base">
              Explore a growing collection of Islamic books, research, and useful reading.
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="font-serif text-3xl font-bold text-[var(--amber-700)]">{books.length}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Books available
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-bold">Latest additions</h2>
          <span className="text-sm text-[var(--muted)]">{books.length} titles</span>
        </div>

        {books.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {books.map((book) => (
              <article
                className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-[0_2px_12px_var(--shadow)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_24px_var(--shadow-strong)]"
                key={`${book.title}-${book.publishedAt ?? ""}`}
              >
                <div className="overflow-hidden border-b border-[var(--line)]">
                  <BookCover book={book} />
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--amber-700)]">
                    {book.category}
                  </p>
                  <h3 className="line-clamp-2 min-h-10 font-serif text-sm font-bold leading-5">
                    {book.title}
                  </h3>
                  {book.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-4 text-[var(--muted)]">
                      {book.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <span className="truncate text-[10px] text-[var(--muted)]">
                      {formatDate(book.publishedAt)}
                    </span>
                    {book.downloadUrl ? (
                      <a
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--amber-500)] px-2 py-1.5 text-[11px] font-bold text-[var(--button-ink)] transition-colors hover:bg-[var(--amber-600)]"
                        href={book.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Download ${book.title} PDF`}
                      >
                        PDF <span aria-hidden="true">↓</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-[var(--muted)]">Read online</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-6 py-16 text-center">
            <h2 className="font-serif text-2xl font-bold">The library is taking a moment</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Please refresh shortly to browse the latest books.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
