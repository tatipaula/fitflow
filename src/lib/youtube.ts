/**
 * Wrapper para YouTube Data API v3.
 * REGRA: nunca hospedar vídeos próprios — apenas buscar e exibir do YouTube.
 */

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string
const BASE_URL = 'https://www.googleapis.com/youtube/v3'

export interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  channelTitle: string
}

/**
 * Busca vídeos demonstrativos para um exercício pelo nome.
 * Retorna array vazio em caso de falha (não lança erro — UI deve lidar com ausência).
 */
export async function searchExerciseVideo(exerciseName: string): Promise<YouTubeVideo[]> {
  if (!API_KEY) {
    console.warn('[youtube] VITE_YOUTUBE_API_KEY não configurada.')
    return []
  }

  try {
    const query = encodeURIComponent(`${exerciseName} exercício como fazer`)
    const url = `${BASE_URL}/search?part=snippet&q=${query}&type=video&videoEmbeddable=true&videoDuration=short&maxResults=3&key=${API_KEY}`

    const response = await fetch(url)
    if (!response.ok) throw new Error(`YouTube API error: ${response.status}`)

    const json = await response.json() as {
      items: Array<{
        id: { videoId: string }
        snippet: { title: string; thumbnails: { default: { url: string } }; channelTitle: string }
      }>
    }

    return json.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.default.url,
      channelTitle: item.snippet.channelTitle,
    }))
  } catch (err) {
    console.error('[youtube] Erro ao buscar vídeo:', err)
    return []
  }
}

/**
 * Retorna a URL de embed do YouTube para exibição no app.
 */
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`
}
