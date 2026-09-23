import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'

type Anime = {
  id: number
  title: {
    romaji: string | null
    english: string | null
    native: string | null
  }
  synonyms: string[]
  coverImage: {
    extraLarge: string | null
    large: string | null
    color: string | null
  }
  description: string | null
  averageScore: number | null
  popularity: number | null
  status: string | null
  format: string | null
  episodes: number | null
  seasonYear: number | null
  genres: string[]
}

type AnimeResponse = {
  data?: {
    Page?: {
      pageInfo?: { total?: number }
      media?: Anime[]
    }
  }
  errors?: Array<{ message: string }>
}

const ANILIST_ENDPOINT = 'https://graphql.anilist.co'
const ANIME_QUERY = `
  query ExploreAnime($search: String, $sort: [MediaSort], $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      pageInfo { total }
      media(type: ANIME, search: $search, sort: $sort, isAdult: false) {
        id
        title { romaji english native }
        synonyms
        coverImage { extraLarge large color }
        description(asHtml: false)
        averageScore
        popularity
        status
        format
        episodes
        seasonYear
        genres
      }
    }
  }
`

const formatLabels: Record<string, string> = {
  TV: 'TV 动画',
  TV_SHORT: '短篇动画',
  MOVIE: '动画电影',
  SPECIAL: '特别篇',
  OVA: 'OVA',
  ONA: '网络动画',
  MUSIC: '音乐动画',
}

const statusLabels: Record<string, string> = {
  FINISHED: '已完结',
  RELEASING: '连载中',
  NOT_YET_RELEASED: '未开播',
  CANCELLED: '已取消',
  HIATUS: '暂停更新',
}

const compactNumber = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </svg>
  )
}

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M7 9h11a5 5 0 0 1 0 10H11" />
      <circle cx="8" cy="20" r="2.5" />
    </svg>
  )
}

function getChineseTitle(anime: Anime) {
  const chineseSynonym = anime.synonyms.find(
    (name) => /[\u4e00-\u9fff]/.test(name) && !/[\u3040-\u30ff]/.test(name),
  )

  return chineseSynonym ?? anime.title.english ?? anime.title.native ?? anime.title.romaji ?? '未命名动漫'
}

function getSecondaryTitle(anime: Anime, primaryTitle: string) {
  return [anime.title.english, anime.title.romaji, anime.title.native].find(
    (title) => title && title !== primaryTitle,
  )
}

function cleanDescription(description: string | null) {
  if (!description) return '暂无剧情简介。'

  const plainText = description
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return plainText || '暂无剧情简介。'
}

function AnimeSkeleton() {
  return (
    <article className="anime-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-cover" />
      <div className="anime-card-body">
        <div className="skeleton skeleton-line skeleton-line-short" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </div>
    </article>
  )
}

export default function App() {
  const [draftQuery, setDraftQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [anime, setAnime] = useState<Anime[]>([])
  const [totalResults, setTotalResults] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    const trimmedQuery = submittedQuery.trim()

    async function loadAnime() {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(ANILIST_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            query: ANIME_QUERY,
            variables: {
              search: trimmedQuery || null,
              sort: [trimmedQuery ? 'SEARCH_MATCH' : 'TRENDING_DESC'],
              perPage: 10,
            },
          }),
          signal: controller.signal,
        })

        const payload = (await response.json()) as AnimeResponse

        if (!response.ok || payload.errors?.length) {
          throw new Error(payload.errors?.[0]?.message || `请求失败（${response.status}）`)
        }

        const page = payload.data?.Page
        setAnime(page?.media ?? [])
        setTotalResults(page?.pageInfo?.total ?? 0)
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return

        setAnime([])
        setTotalResults(0)
        setError('暂时没能取得动漫资料，请稍后重试。')
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAnime()
    return () => controller.abort()
  }, [submittedQuery, retryCount])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        document.activeElement?.tagName !== 'INPUT'
      ) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }

    document.addEventListener('keydown', focusSearch)
    return () => document.removeEventListener('keydown', focusSearch)
  }, [])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextQuery = draftQuery.trim()

    if (nextQuery === submittedQuery) {
      setRetryCount((count) => count + 1)
      return
    }

    setSubmittedQuery(nextQuery)
  }

  const clearSearch = () => {
    setDraftQuery('')
    setSubmittedQuery('')
    searchRef.current?.focus()
  }

  const isSearching = Boolean(submittedQuery)

  return (
    <div className="site-shell">
      <a className="skip-link" href="#anime-results">
        跳到动漫列表
      </a>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="网搜首页">
          <span className="brand-icon">
            <BrandMark />
          </span>
          <span>网搜</span>
        </a>
        <nav aria-label="主导航">
          <a href="#anime-results">热门动漫</a>
          <a href="#search-input">搜索动漫</a>
        </nav>
        <a className="header-search" href="#search-input">
          <SearchIcon />
          <span>搜索</span>
        </a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <img
            className="hero-image"
            src={`${import.meta.env.BASE_URL}hero-anime-night.png`}
            alt="原创动漫风格的月夜城市屋顶"
            width="1672"
            height="941"
          />
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-content">
            <p className="eyebrow">
              <span aria-hidden="true" /> LIVE ANIME DISCOVERY
            </p>
            <h1 id="hero-title">
              先看今天最火的，
              <br />
              <em>想看的直接搜。</em>
            </h1>
            <p className="hero-summary">
              首页实时推荐 10 部热门动漫，也支持用中文、日文或英文标题查找更多作品。
            </p>

            <form className="search-box" role="search" onSubmit={handleSearch}>
              <SearchIcon />
              <label className="sr-only" htmlFor="search-input">
                搜索动漫名称
              </label>
              <input
                ref={searchRef}
                id="search-input"
                type="search"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="输入动漫名称，例如：火影忍者"
                autoComplete="off"
              />
              {draftQuery ? (
                <button className="clear-button" type="button" onClick={clearSearch} aria-label="清除搜索">
                  清除
                </button>
              ) : (
                <kbd aria-hidden="true">/</kbd>
              )}
              <button className="submit-button" type="submit">
                搜索
              </button>
            </form>

            <div className="hero-meta" aria-label="搜索说明">
              <span>实时热门榜</span>
              <span aria-hidden="true">·</span>
              <span>一次显示 10 部</span>
              <span aria-hidden="true">·</span>
              <span>不提供盗版播放源</span>
            </div>
          </div>
        </section>

        <section className="anime-results" id="anime-results" aria-labelledby="results-title">
          <div className="results-heading">
            <div>
              <p className="section-label">{isSearching ? 'SEARCH RESULTS' : 'TRENDING NOW'}</p>
              <h2 id="results-title">
                {isSearching ? `“${submittedQuery}”的搜索结果` : '现在最火的 10 部动漫'}
              </h2>
            </div>
            <p className="result-count" aria-live="polite">
              {isLoading
                ? '正在加载…'
                : isSearching
                  ? `找到 ${compactNumber.format(totalResults)} 部相关作品 · 显示前 ${anime.length} 部`
                  : `已更新 ${anime.length} 部热门作品`}
            </p>
          </div>

          {isLoading ? (
            <div className="anime-grid" aria-label="正在加载动漫">
              {Array.from({ length: 10 }, (_, index) => (
                <AnimeSkeleton key={index} />
              ))}
            </div>
          ) : error ? (
            <div className="message-state" role="alert">
              <span className="message-symbol" aria-hidden="true">!</span>
              <h3>加载遇到一点问题</h3>
              <p>{error}</p>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}>
                重新加载
              </button>
            </div>
          ) : anime.length === 0 ? (
            <div className="message-state">
              <span className="message-symbol" aria-hidden="true">⌕</span>
              <h3>没有找到这部动漫</h3>
              <p>可以尝试简称、原名或英文名。</p>
              <button type="button" onClick={clearSearch}>
                返回热门榜
              </button>
            </div>
          ) : (
            <div className="anime-grid">
              {anime.map((item, index) => {
                const primaryTitle = getChineseTitle(item)
                const secondaryTitle = getSecondaryTitle(item, primaryTitle)
                const cover = item.coverImage.extraLarge ?? item.coverImage.large

                return (
                  <article
                    className="anime-card"
                    key={item.id}
                    style={{ '--anime-accent': item.coverImage.color ?? '#6ee7f7' } as CSSProperties}
                  >
                    <div className="cover-wrap">
                      {cover ? (
                        <img
                          src={cover}
                          alt={`${primaryTitle} 封面`}
                          loading={index < 5 ? 'eager' : 'lazy'}
                          width="460"
                          height="650"
                        />
                      ) : (
                        <div className="cover-fallback" aria-hidden="true">网搜</div>
                      )}
                      <span className="rank-badge">#{index + 1}</span>
                      {item.averageScore ? (
                        <span className="score-badge" aria-label={`评分 ${item.averageScore} 分`}>
                          ★ {item.averageScore}
                        </span>
                      ) : null}
                    </div>

                    <div className="anime-card-body">
                      <div className="anime-status-row">
                        <span>{item.format ? formatLabels[item.format] ?? item.format : '动画'}</span>
                        <span>{item.status ? statusLabels[item.status] ?? item.status : '状态未知'}</span>
                      </div>
                      <h3>{primaryTitle}</h3>
                      {secondaryTitle ? <p className="secondary-title">{secondaryTitle}</p> : null}
                      <p className="anime-description">{cleanDescription(item.description)}</p>

                      <div className="genre-list" aria-label="动漫类型">
                        {item.genres.slice(0, 3).map((genre) => (
                          <span key={genre}>{genre}</span>
                        ))}
                      </div>

                      <div className="anime-meta">
                        <span>{item.seasonYear ?? '年份未知'}</span>
                        <span>{item.episodes ? `${item.episodes} 集` : '集数待定'}</span>
                        <span>{item.popularity ? `${compactNumber.format(item.popularity)} 人气` : '人气统计中'}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className="site-note" aria-labelledby="site-note-title">
          <div>
            <p className="section-label">ABOUT WANGSOU</p>
            <h2 id="site-note-title">找作品，不推站点。</h2>
          </div>
          <p>
            网搜只展示动漫资料与热门趋势，不在首页推荐第三方网站，也不收录盗版播放、下载或绕过付费限制的入口。
          </p>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#top">网搜</a>
        <p>动漫资料由 AniList API 提供</p>
        <p>界面基于 Aeri 改造 · Apache-2.0</p>
      </footer>
    </div>
  )
}
