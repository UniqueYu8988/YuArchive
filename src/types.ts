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
  tags: string[]
  content: string
}

export interface TextsCategory {
  key: string
  display_name: string
  total_count: number
  sort_mode: 'text'
  items: TextItem[]
}

export type Category = TimelineCategory | MusicCategory | TextsCategory

/** 整个 archive_data.json 的顶层结构 */
export interface ArchiveData {
  metadata: {
    generated_at: string
    source_root: string
    version: string
  }
  categories: {
    games: TimelineCategory
    visions: TimelineCategory // 新的光影混合类别
    music: MusicCategory
    texts: TextsCategory
  }
}
