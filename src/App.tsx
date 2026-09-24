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
  streamingEpisodes: StreamingEpisode[] | null
  externalLinks: AnimeExternalLink[] | null
  siteUrl: string | null
}

type StreamingEpisode = {
  title: string | null
  thumbnail: string | null
  url: string | null
  site: string | null
}

type AnimeExternalLink = {
  url: string | null
  site: string | null
  type: string | null
  language: string | null
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
const YINGHUA_SEARCH_URL = 'https://yinghuadongman.org.cn/u/'
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
        streamingEpisodes { title thumbnail url site }
        externalLinks { url site type language }
        siteUrl
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

function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function getYinghuaSearchUrl(query: string) {
  const url = new URL(YINGHUA_SEARCH_URL)
  url.searchParams.set('wd', query)
  return url.href
}

function getYouTubeEmbedUrl(value: string | null | undefined) {
  const safeUrl = safeExternalUrl(value)
  if (!safeUrl) return null

  const url = new URL(safeUrl)
  const host = url.hostname.toLowerCase()
  const youtubeHosts = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
  ])

  if (!youtubeHosts.has(host)) return null

  let videoId = ''
  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? ''
  } else if (url.pathname === '/watch') {
    videoId = url.searchParams.get('v') ?? ''
  } else {
    videoId = url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? ''
  }

  if (!/^[\w-]{6,20}$/.test(videoId)) return null

  const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`)
  embedUrl.searchParams.set('playsinline', '1')
  embedUrl.searchParams.set('rel', '0')
  embedUrl.searchParams.set('origin', window.location.origin)
  return embedUrl.href
}

function getWatchEpisodes(anime: Anime) {
  return (anime.streamingEpisodes ?? []).filter((episode) => {
    const title = episode.title ?? ''
    return safeExternalUrl(episode.url) && !/\b(trailer|teaser|preview|promotional video|pv)\b/i.test(title)
  })
}

function getStreamingLinks(anime: Anime) {
  const uniqueLinks = new Map<string, AnimeExternalLink>()

  for (const link of anime.externalLinks ?? []) {
    const url = link.type === 'STREAMING' ? safeExternalUrl(link.url) : null
    if (url && !uniqueLinks.has(url)) uniqueLinks.set(url, link)
  }

  return [...uniqueLinks.entries()].map(([url, link]) => ({ ...link, url }))
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
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<StreamingEpisode | null>(null)
  const [watchSource, setWatchSource] = useState<'yinghua' | 'official'>('yinghua')
  const [sourceDraft, setSourceDraft] = useState('')
  const [sourceQuery, setSourceQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const lastFocusedAnimeRef = useRef<HTMLButtonElement | null>(null)

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

  useEffect(() => {
    if (!selectedAnime) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedAnime(null)
        setSelectedEpisode(null)
        requestAnimationFrame(() => lastFocusedAnimeRef.current?.focus())
      }
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [selectedAnime])

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

  const openWatchPage = (item: Anime, button: HTMLButtonElement) => {
    lastFocusedAnimeRef.current = button
    const title = getChineseTitle(item)
    setSelectedAnime(item)
    setSelectedEpisode(getWatchEpisodes(item)[0] ?? null)
    setWatchSource('yinghua')
    setSourceDraft(title)
    setSourceQuery(title)
  }

  const closeWatchPage = () => {
    setSelectedAnime(null)
    setSelectedEpisode(null)
    requestAnimationFrame(() => lastFocusedAnimeRef.current?.focus())
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
              <span>支持第三方播放来源</span>
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
              {submittedQuery ? (
                <a href={getYinghuaSearchUrl(submittedQuery)} target="_blank" rel="noreferrer">
                  在樱花动漫搜索此名称 ↗
                </a>
              ) : null}
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
                const watchCount = getWatchEpisodes(item).length

                return (
                  <button
                    className="anime-card"
                    key={item.id}
                    style={{ '--anime-accent': item.coverImage.color ?? '#6ee7f7' } as CSSProperties}
                    type="button"
                    aria-label={`${primaryTitle}，打开在线播放详情`}
                    onClick={(event) => openWatchPage(item, event.currentTarget)}
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
                      <span className="watch-card-action">
                        <span>{watchCount ? `${watchCount} 个正版集数 · 搜索更多来源` : '搜索播放来源'}</span>
                        <span aria-hidden="true">↗</span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {selectedAnime ? (() => {
          const title = getChineseTitle(selectedAnime)
          const episodes = getWatchEpisodes(selectedAnime)
          const streamingLinks = getStreamingLinks(selectedAnime)
          const activeEpisodeUrl = safeExternalUrl(selectedEpisode?.url)
          const embedUrl = getYouTubeEmbedUrl(activeEpisodeUrl)

          return (
            <div className="watch-backdrop" onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeWatchPage()
            }}>
              <section className="watch-dialog" role="dialog" aria-modal="true" aria-labelledby="watch-title">
                <div className="watch-header">
                  <div>
                    <p className="section-label">WATCH ANIME</p>
                    <h2 id="watch-title">{title}</h2>
                    <p className="watch-subtitle">
                      {watchSource === 'yinghua'
                        ? '在樱花动漫搜索作品，选择结果和剧集后播放'
                        : 'AniList 标注的正版入口 · 可用地区和免费情况以平台说明为准'}
                    </p>
                  </div>
                  <button className="watch-close" type="button" onClick={closeWatchPage} aria-label="关闭播放详情">
                    ×
                  </button>
                </div>

                <div className="watch-source-tabs" role="group" aria-label="选择播放来源">
                  <button
                    type="button"
                    className={watchSource === 'yinghua' ? 'is-active' : ''}
                    aria-pressed={watchSource === 'yinghua'}
                    onClick={() => setWatchSource('yinghua')}
                  >
                    樱花动漫
                  </button>
                  <button
                    type="button"
                    className={watchSource === 'official' ? 'is-active' : ''}
                    aria-pressed={watchSource === 'official'}
                    onClick={() => setWatchSource('official')}
                  >
                    正版平台
                  </button>
                </div>

                {watchSource === 'yinghua' ? (
                  <div className="third-party-source">
                    <form className="third-party-search" role="search" onSubmit={(event) => {
                      event.preventDefault()
                      const nextQuery = sourceDraft.trim()
                      if (nextQuery) setSourceQuery(nextQuery)
                    }}>
                      <label htmlFor="third-party-query">搜索樱花动漫资源</label>
                      <div>
                        <input
                          id="third-party-query"
                          type="search"
                          value={sourceDraft}
                          onChange={(event) => setSourceDraft(event.target.value)}
                          placeholder="输入作品名称"
                        />
                        <button type="submit">搜索</button>
                      </div>
                    </form>
                    <div className="third-party-frame">
                      <iframe
                        key={sourceQuery}
                        src={getYinghuaSearchUrl(sourceQuery)}
                        title={`樱花动漫搜索：${sourceQuery}`}
                        sandbox="allow-forms allow-same-origin allow-scripts allow-presentation"
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        referrerPolicy="no-referrer"
                        allowFullScreen
                      />
                    </div>
                    <p className="third-party-note">
                      页面和播放内容由樱花动漫提供。若无法在上方操作，
                      <a href={getYinghuaSearchUrl(sourceQuery)} target="_blank" rel="noreferrer">在来源网站打开 ↗</a>
                    </p>
                  </div>
                ) : (
                  <>

                {episodes.length > 0 ? (
                  <div className="watch-layout">
                    <div className="watch-player-column">
                      {selectedEpisode && embedUrl ? (
                        <div className="watch-video-frame">
                          <iframe
                            src={embedUrl}
                            title={`${title} · ${selectedEpisode.title ?? '正版在线播放'}`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                          />
                        </div>
                      ) : selectedEpisode && activeEpisodeUrl ? (
                        <div className="external-player-state">
                          <span className="external-play-icon" aria-hidden="true">▶</span>
                          <h3>{selectedEpisode.title || '选择的剧集'}</h3>
                          <p>此正版片源由 {selectedEpisode.site || '对应平台'} 播放。</p>
                          <a href={activeEpisodeUrl} target="_blank" rel="noreferrer">
                            在 {selectedEpisode.site || '官方平台'} 中播放 <span aria-hidden="true">↗</span>
                          </a>
                        </div>
                      ) : (
                        <div className="external-player-state">
                          <h3>选择一集开始观看</h3>
                          <p>播放由对应正版平台提供。</p>
                        </div>
                      )}

                      <div className="watch-now-playing">
                        <div>
                          <p className="section-label">正在播放</p>
                          <h3>{selectedEpisode?.title || '选择一集'}</h3>
                        </div>
                        <span>{selectedEpisode?.site || '在线播放'}</span>
                      </div>
                    </div>

                    <aside className="episode-panel" aria-label="正版在线播放集">
                      <h3>可播放剧集 <span>{episodes.length}</span></h3>
                      <div className="episode-list">
                        {episodes.map((episode, episodeIndex) => {
                          const isSelected = episode === selectedEpisode

                          return (
                            <button
                              className={`episode-option${isSelected ? ' is-selected' : ''}`}
                              type="button"
                              key={`${episode.site ?? 'source'}-${episode.url}`}
                              aria-pressed={isSelected}
                              onClick={() => setSelectedEpisode(episode)}
                            >
                              {episode.thumbnail && safeExternalUrl(episode.thumbnail) ? (
                                <img src={safeExternalUrl(episode.thumbnail) ?? undefined} alt="" loading="lazy" />
                              ) : (
                                <span className="episode-number">{episodeIndex + 1}</span>
                              )}
                              <span className="episode-option-copy">
                                <strong>{episode.title || `第 ${episodeIndex + 1} 集`}</strong>
                                <span>{episode.site || '正版播放平台'}</span>
                              </span>
                              <span className="episode-play" aria-hidden="true">
                                {isSelected ? '▶' : '›'}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </aside>
                  </div>
                ) : (
                  <div className="no-episode-state">
                    <span aria-hidden="true">◷</span>
                    <h3>暂未收录可直接播放的正版集数</h3>
                    <p>可以从以下作品所属的正版流媒体平台查看播放情况。</p>
                  </div>
                )}

                {streamingLinks.length > 0 ? (
                  <div className="streaming-links">
                    <h3>{episodes.length ? '更多正版平台' : '正版流媒体平台'}</h3>
                    <div>
                      {streamingLinks.map((link) => (
                        <a key={link.url} href={link.url ?? undefined} target="_blank" rel="noreferrer">
                          <span>{link.site || '打开流媒体平台'}</span>
                          {link.language ? <small>{link.language}</small> : null}
                          <span aria-hidden="true">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                  </>
                )}

                <div className="watch-footer">
                  <span>
                    {watchSource === 'yinghua'
                      ? '第三方来源：樱花动漫（资源由来源网站提供）'
                      : '播放来源：AniList 标注的合法流媒体入口'}
                  </span>
                  {safeExternalUrl(selectedAnime.siteUrl) ? (
                    <a href={safeExternalUrl(selectedAnime.siteUrl) ?? undefined} target="_blank" rel="noreferrer">
                      动漫资料 <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                </div>
              </section>
            </div>
          )
        })() : null}

        <section className="site-note" aria-labelledby="site-note-title">
          <div>
            <p className="section-label">ABOUT WANGSOU</p>
            <h2 id="site-note-title">找作品，不推站点。</h2>
          </div>
          <p>
            网搜展示动漫资料与热门趋势。点击作品可搜索樱花动漫资源，也可查看 AniList 标注的正版平台。
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
