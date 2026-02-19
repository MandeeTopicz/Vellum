/**
 * ShapeIcon – inline SVG icons for shape selector buttons.
 * Renders stroke-only icons matching each shape type.
 */
import curvedArrowCcwIcon from '../../assets/curved-arrow-ccw.png'
import curvedArrowCwIcon from '../../assets/curved-arrow-cw.png'
import arrowStraightIcon from '../../assets/arrow-straight-icon.png'
import arrowDoubleIcon from '../../assets/arrow-double-icon.png'
import rectangleIcon from '../../assets/rectangle-icon.png'
import triangleIcon from '../../assets/triangle-icon.png'
import circleIcon from '../../assets/circle-icon.png'
import diamondIcon from '../../assets/diamond-icon.png'
import triangleInvertedIcon from '../../assets/triangle-inverted-icon.png'
import pentagonIcon from '../../assets/pentagon-icon.png'
import hexagonIcon from '../../assets/hexagon-icon.png'
import starIcon from '../../assets/star-icon.png'
import plusIcon from '../../assets/plus-icon.png'
import arrowElbowBidirectionalIcon from '../../assets/arrow-elbow-bidirectional-icon.png'
import parallelogramRightIcon from '../../assets/parallelogram-right-icon.png'
import parallelogramLeftIcon from '../../assets/parallelogram-left-icon.png'
import cylinderIcon from '../../assets/cylinder-icon.png'
import cylinderHorizontalIcon from '../../assets/cylinder-horizontal-icon.png'
import trapezoidIcon from '../../assets/trapezoid-icon.png'

interface ShapeIconProps {
  type: string
}

const iconProps = {
  width: 48,
  height: 48,
  viewBox: '0 0 24 24',
  stroke: 'currentColor',
  strokeWidth: 2,
  fill: 'none' as const,
}

export default function ShapeIcon({ type }: ShapeIconProps) {
  switch (type) {
    case 'arrow-straight':
      return <img src={arrowStraightIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'arrow-curved':
      return <img src={curvedArrowCcwIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'arrow-curved-cw':
      return <img src={curvedArrowCwIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'arrow-elbow-bidirectional':
      return <img src={arrowElbowBidirectionalIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'arrow-double':
      return <img src={arrowDoubleIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'rectangle':
      return <img src={rectangleIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'circle':
      return <img src={circleIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'diamond':
      return <img src={diamondIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'triangle':
      return <img src={triangleIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'triangle-inverted':
      return <img src={triangleInvertedIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'pentagon':
      return <img src={pentagonIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'hexagon':
      return <img src={hexagonIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'plus':
      return <img src={plusIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'arrow-left':
      return (
        <svg {...iconProps}>
          <path d="M4 8 L8 4 L8 7 L20 7 L20 9 L8 9 L8 12 Z" />
        </svg>
      )
    case 'arrow-right':
      return (
        <svg {...iconProps}>
          <path d="M20 8 L16 4 L16 7 L4 7 L4 9 L16 9 L16 12 Z" />
        </svg>
      )
    case 'star':
      return <img src={starIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'text-box':
      return (
        <svg {...iconProps}>
          <rect x="4" y="7" width="16" height="10" />
          <path d="M8 10 L16 10 M8 13 L14 13" />
        </svg>
      )
    case 'parallelogram-right':
      return <img src={parallelogramRightIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'parallelogram-left':
      return <img src={parallelogramLeftIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'cylinder-vertical':
      return <img src={cylinderIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'cylinder-horizontal':
      return <img src={cylinderHorizontalIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'tab-shape':
      return (
        <svg {...iconProps} viewBox="0 0 16 16" stroke="#000000" strokeWidth={1}>
          <path d="M1.5 5 L5.5 5 L8 2 L10.5 5 L14.5 5 L14.5 14 L1.5 14 Z" />
        </svg>
      )
    case 'trapezoid':
      return <img src={trapezoidIcon} alt="" width={48} height={48} style={{ objectFit: 'contain' }} />
    case 'circle-cross':
      return (
        <svg {...iconProps} viewBox="0 0 16 16" stroke="#000000" strokeWidth={1}>
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 2 L8 14 M2 8 L14 8" />
        </svg>
      )
    default:
      return <div style={{ width: 48, height: 48 }} />
  }
}
