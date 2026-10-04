import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

interface PanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  radiusSize?: number;
  shadowOffset?: number;
  borderWidth?: number;
}

/**
 * The signature "manga panel" container: a thick ink outline plus a solid,
 * offset ink shadow block (not a soft blur) sitting behind it. Every card,
 * tile, and sheet in the app is built from this so the bordered-panel +
 * hard-shadow language stays identical everywhere.
 */
export function Panel({
  children,
  style,
  contentStyle,
  backgroundColor = colors.surface,
  radiusSize = radius.lg,
  shadowOffset = 5,
  borderWidth = 2.5,
}: PanelProps) {
  return (
    <View style={style}>
      <View
        style={[
          styles.shadowBlock,
          { top: shadowOffset, left: shadowOffset, borderRadius: radiusSize, backgroundColor: colors.ink },
        ]}
      />
      <View
        style={[
          styles.panel,
          { backgroundColor, borderRadius: radiusSize, borderWidth, borderColor: colors.ink },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowBlock: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  panel: {
    zIndex: 1,
  },
});
