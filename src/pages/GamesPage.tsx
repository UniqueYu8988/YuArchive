import TimelineView from '../components/TimelineView'
import type { TimelineCategory } from '../types'

interface Props {
  data: TimelineCategory
}

export default function GamesPage({ data }: Props) {
  return (
    <TimelineView
      data={data}
      title="溯游纪元"
      subtitle="在虚拟的边界，重塑无数次人生"
      showEasterEgg={true}
      mode="games"
    />
  )
}
