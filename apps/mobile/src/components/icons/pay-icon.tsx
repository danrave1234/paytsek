import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { GLYPHS, GLYPH_STROKE, GLYPH_TINT_OPACITY, resolveIcon, type Glyph, type GlyphName } from './glyphs';

type Props = {
  name: GlyphName;
  size?: number;
  color: string;
  /** Active variant: a soft fill under the same strokes, never a different shape. */
  tinted?: boolean;
};

/** Renders one PayTsek glyph. Decorative by default; label the parent control. */
export const PayIcon = React.memo(function PayIcon({ name, size = 24, color, tinted = false }: Props) {
  const glyph: Glyph = GLYPHS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {tinted ? glyph.tint?.map((d, index) => <Path key={`t${index}`} d={d} fill={color} opacity={GLYPH_TINT_OPACITY} />) : null}
      {glyph.solid?.map((d, index) => <Path key={`s${index}`} d={d} fill={color} />)}
      {glyph.d.map((d, index) => (
        <Path key={`d${index}`} d={d} fill="none" stroke={color} strokeWidth={GLYPH_STROKE} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {glyph.circles?.map(([cx, cy, r], index) => (
        <Circle key={`c${index}`} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={GLYPH_STROKE} />
      ))}
      {glyph.dots?.map(([cx, cy, r], index) => <Circle key={`o${index}`} cx={cx} cy={cy} r={r} fill={color} />)}
    </Svg>
  );
});

/**
 * Paper's `settings.icon` hook: every string icon in Paper components and in
 * our own `<Icon source="…">` calls is drawn from the PayTsek set. Unknown or
 * brand names fall back to the vector font so nothing ever renders blank.
 */
export function renderPaperIcon({ name, color, size }: { name: string; color?: string; size: number }) {
  const resolved = resolveIcon(name);
  const tint = color ?? '#000000';
  if (resolved) return <PayIcon name={resolved.glyph} tinted={resolved.tinted} size={size} color={tint} />;
  return <MaterialCommunityIcons name={name as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={size} color={tint} />;
}
