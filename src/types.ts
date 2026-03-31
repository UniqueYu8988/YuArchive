// 全局数据类型定义

/** 单个作品条目 */
export interface ArchiveItem {
  id: string            // 唯一 ID，如 "games_2024_0"
  image_path: string    // 相对于数据根目录的路径
  title: string         // 作品名称（从文件名提取）
  cinema?: boolean      // 是否显示电影院钒印（Movies/Animes 专属）
  quote?: string        // 悬停时展示的短评金句
  url?: string          // 作品对应的外部传送门链接（Visions 专属）
  type?: 'movie' | 'anime' | 'tv' | string // 混合时间线分类标记（Visions 专属）
  game_meta_enabled?: boolean
  english_title?: string
  platform?: 'steam' | 'xbox' | 'riotgame' | 'battlenet' | 'playstation' | 'switch' | string
  price?: string
  rating?: number | ''
  playtime?: '<1h' | '<10h' | '<50h' | '<100h' | '>100h' | string
  completed?: boolean
  genre?: 'action' | 'rpg' | 'strategy' | 'shooter' | 'simulation' | 'sports' | 'racing' | 'puzzle' | 'casual' | string
  seasonal?: boolean
  dlc?: boolean
  dlc_parent?: string
  summary?: string
  hover_note?: string
  season_heading?: string
  season_subheading?: string
  season_description?: string
  season_entries?: Array<{
    id: string
    title: string
    image_path: string
    label?: string
    champion?: string
    note?: string
    period?: string
    theme?: string
    feature?: string
    build?: string
    icon_path?: string
  }>
}

/** 时间线年份分组（用于 Games / Movies / Animes） */
export interface YearGroup {
  year: number          // 年份，如 2024
  folder: string        // 原始文件夹名，如 "Game-2024"
  items: ArchiveItem[]  // 该年份的作品列表
}

/** 时间线类别（sort_mode = "timeline"） */
export interface TimelineCategory {
  key: string           // "games" | "movies" | "animes"
  display_name: string  // "Games" | "Movies" | "Animes"
  total_count: number
  sort_mode: 'timeline'
  years: YearGroup[]
}

/** Music 类别（基于 Markdown 单文件的新版） */
export interface MusicItem {
  id: string
  title: string
  cover: string      // 封面图片相对路径
  description?: string // 专辑短评/描述
  content: string    // 音轨列表的 markdown 正文
  audio?: string
  track_title?: string
}

export interface MusicCategory {
  key: string
  display_name: string
  total_count: number
  sort_mode: 'music'
  items: MusicItem[]
}

/** 文字类别（sort_mode = "text"） */
export interface TextItem {
  id: string
  title: string
  date: string
  sort_date?: string
  section?: string
  section_title?: string
  tags: string[]
  content: string
}

export interface TextSection {
  key: string
  title: string
  description?: string
  count: number
}

export interface TextsCategory {
  key: string
  display_name: string
  total_count: number
  sort_mode: 'text'
  sections?: TextSection[]
  items: TextItem[]
}

export type Category = TimelineCategory | MusicCategory | TextsCategory

export interface SiteUiConfig {
  current_album: string
  selected_section: string
  unclassified: string
  unknown: string
  unrated: string
  season_journey: string
  season_special: string
}

export interface SiteLayoutConfig {
  home_latest_games_count: number
  home_latest_visions_count: number
  home_latest_music_count: number
  home_latest_texts_count: number
  games_season_target_year: number
  games_season_priority: Record<string, number>
  texts_default_section_key: string
}

export interface HomepageConfig {
  games: string[]
  visions: string[]
  music: string[]
  texts: string[]
}

/** 整个 archive_data.json 的顶层结构 */
export interface ArchiveData {
  metadata: {
    generated_at: string
    source_root: string
    version: string
    site_ui?: SiteUiConfig
    site_layout?: SiteLayoutConfig
    homepage?: HomepageConfig
    validation?: {
      games_meta_skipped_folders?: string[]
      games_meta_templates_updated?: string[]
      games_meta_inventory?: Array<{
        folder: string
        title: string
        english_title?: string
        suggested_english_title?: string
        platform?: string
        genre?: string
        rating?: number | ''
        playtime?: string
        price?: string
        completed?: boolean
        url?: string
        has_english_title?: boolean
        has_url?: boolean
        has_price?: boolean
        has_genre?: boolean
        has_rating?: boolean
        has_playtime?: boolean
      }>
      games_steam_autofill_hits?: number
      games_steam_autofill_misses?: number
      games_meta_todo?: Array<{
        folder: string
        title: string
        english_title?: string
        platform?: string
        genre?: string
        rating?: number | ''
        playtime?: string
        price?: string
        completed?: boolean
        url?: string
        search_hint?: string
        missing: string[]
      }>
      music_missing_covers: Array<{ title: string; file: string; cover: string }>
      music_external_covers: string[]
      texts_date_issues: Array<{
        title: string
        file: string
        raw_date: string
        normalized_date: string
        status: string
      }>
      visions_orphan_meta: string[]
    }
  }
  categories: {
    games: TimelineCategory
    visions: TimelineCategory // 新的光影混合类别
    music: MusicCategory
    texts: TextsCategory
  }
}
