import {
  Button,
  ContextMenu,
  HStack,
  Host,
  Image,
  List,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  background,
  buttonStyle,
  foregroundStyle,
  frame,
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listRowSpacing,
  listStyle,
  padding,
  scrollContentBackground,
  shapes,
  strokeBorder,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import type {
  NativeSwipeActionsListItem,
  NativeSwipeActionsListProps,
} from './NativeSwipeActionsList.types';
import { roundedFont } from '../nativeTypography';

const ROW_HEIGHT = 92;
const ROW_SPACING = 8;

function SelectionIndicator({
  selected,
  colors,
}: {
  selected: boolean;
  colors: NativeSwipeActionsListProps['colors'];
}) {
  return (
    <Text
      modifiers={[
        frame({ width: 24, height: 24, alignment: 'center' }),
        background(selected ? colors.selectionSurface : 'clear', shapes.circle()),
        strokeBorder({
          color: colors.border,
          shape: 'circle',
          style: { lineWidth: 1.5 },
        }),
      ]}
    >
      <Image
        color={selected ? colors.selectionContent : 'clear'}
        size={14}
        systemName="checkmark"
      />
    </Text>
  );
}

function DeliveryRow({
  item,
  colors,
  isSelectionMode,
  selected,
  onItemPress,
  onDelete,
  action,
  trailingValueAlignment,
}: {
  item: NativeSwipeActionsListItem;
  colors: NativeSwipeActionsListProps['colors'];
  isSelectionMode: boolean;
  selected: boolean;
  onItemPress?: (id: string) => void;
  onDelete: (id: string) => void;
  action: NonNullable<NativeSwipeActionsListProps['action']>;
  trailingValueAlignment: NonNullable<NativeSwipeActionsListProps['trailingValueAlignment']>;
}) {
  return (
    <ContextMenu
      modifiers={[
        listRowBackground('clear'),
        listRowSeparator('hidden'),
        listRowInsets({ top: 0, bottom: 0, leading: 0, trailing: 0 }),
      ]}
    >
      <ContextMenu.Trigger>
        <Button
          modifiers={[buttonStyle('plain')]}
          onPress={onItemPress ? () => onItemPress(item.id) : undefined}
        >
          <VStack
            alignment="leading"
            spacing={8}
            modifiers={[
              frame({ maxWidth: Infinity, alignment: 'leading' }),
              padding({ top: 13, bottom: 13 }),
            ]}
          >
            <Text
              modifiers={[
                roundedFont({ textStyle: 'caption' }),
                foregroundStyle(colors.textSecondary),
              ]}
            >
              {item.overline}
            </Text>
            <HStack
              alignment={trailingValueAlignment}
              spacing={0}
              modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}
            >
              <HStack alignment="center" spacing={12}>
                {isSelectionMode ? (
                  <SelectionIndicator colors={colors} selected={selected} />
                ) : null}
                <VStack alignment="leading" spacing={2}>
                  <Text
                    modifiers={[
                      item.titleBold
                        ? roundedFont({ size: 17, weight: 'bold' })
                        : roundedFont({ textStyle: 'body' }),
                      foregroundStyle(colors.textPrimary),
                    ]}
                  >
                    {item.title}
                  </Text>
                  <Text
                    modifiers={[
                      roundedFont({ textStyle: 'footnote' }),
                      foregroundStyle(colors.textSecondary),
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                </VStack>
              </HStack>
              <Spacer />
              <HStack alignment="center" spacing={4}>
                {item.trailingSystemImage ? (
                  <Image
                    color={item.trailingSystemImageColor ?? colors.textSecondary}
                    size={16}
                    systemName={item.trailingSystemImage}
                  />
                ) : null}
                <Text
                  modifiers={[
                    roundedFont({ textStyle: 'body' }),
                    foregroundStyle(colors.textPrimary),
                  ]}
                >
                  {item.trailingText}
                </Text>
              </HStack>
            </HStack>
          </VStack>
        </Button>
      </ContextMenu.Trigger>
      <ContextMenu.Items>
        <Button
          label={action.label}
          modifiers={[roundedFont({}), ...(action.tint ? [tint(action.tint)] : [])]}
          role={action.role}
          systemImage={action.systemImage}
          onPress={() => onDelete(item.id)}
        />
      </ContextMenu.Items>
    </ContextMenu>
  );
}

export default function NativeSwipeActionsList({
  items,
  colors,
  isSelectionMode = false,
  selectedIds,
  onItemPress,
  onDelete,
  action = { label: 'Excluir', role: 'destructive', systemImage: 'trash' },
  trailingValueAlignment = 'center',
}: NativeSwipeActionsListProps) {
  return (
    <Host
      style={{
        width: '100%',
        height: Math.max(
          ROW_HEIGHT,
          items.length * ROW_HEIGHT + Math.max(0, items.length - 1) * ROW_SPACING,
        ),
      }}
    >
      <List
        modifiers={[
          listStyle('plain'),
          listRowSpacing(ROW_SPACING),
          scrollContentBackground('hidden'),
        ]}
      >
        {items.map((item) => (
          <DeliveryRow
            key={item.id}
            colors={colors}
            isSelectionMode={isSelectionMode}
            item={item}
            onDelete={onDelete}
            onItemPress={onItemPress}
            selected={selectedIds?.has(item.id) ?? false}
            action={action}
            trailingValueAlignment={trailingValueAlignment}
          />
        ))}
      </List>
    </Host>
  );
}
