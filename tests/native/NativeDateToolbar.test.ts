/* eslint-disable @typescript-eslint/no-require-imports */

import React, { type ReactElement, type ReactNode } from 'react';
import { Stack } from 'expo-router';

import { renderNativeDateToolbarItems } from '@/components/native/NativeDateToolbar';

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const Menu = ({ children, ...props }: { children?: ReactNode }) =>
    React.createElement('toolbar-menu', props, children);
  const MenuAction = ({ children, ...props }: { children?: ReactNode }) =>
    React.createElement('toolbar-menu-action', props, children);
  const Label = ({ children }: { children?: ReactNode }) =>
    React.createElement('toolbar-label', null, children);
  const Toolbar = Object.assign(() => null, { Menu, MenuAction, Label });

  return { Stack: { Toolbar } };
});

const toolbar = Stack.Toolbar as unknown as {
  Label: React.ElementType;
  Menu: React.ElementType;
  MenuAction: React.ElementType;
};

type ToolbarElementProps = {
  accessibilityLabel?: string;
  children?: ReactNode;
  isOn?: boolean;
  onPress?: () => void;
  separateBackground?: boolean;
  title?: string;
};

type ToolbarElement = ReactElement<ToolbarElementProps>;

function elements(node: ReactNode): ToolbarElement[] {
  return React.Children.toArray(node).filter(React.isValidElement) as ToolbarElement[];
}

function getLabel(menu: ToolbarElement): string {
  const label = elements(menu.props.children).find((child) => child.type === toolbar.Label);
  return String(label?.props.children);
}

describe('NativeDateToolbar', () => {
  it('splits day and month triggers into adjacent native menus with shared backgrounds', () => {
    const onDateChange = jest.fn();
    const menus = elements(
      renderNativeDateToolbarItems({
        mode: 'day',
        onDateChange,
        selectedDate: '2026-10-15',
        splitDayAndMonthInteraction: true,
      }),
    );

    expect(menus).toHaveLength(2);
    expect(menus.every((menu) => menu.type === toolbar.Menu)).toBe(true);
    expect(menus.map((menu) => menu.props.separateBackground)).toEqual([false, false]);
    expect(menus.map(getLabel)).toEqual(['15', 'Out']);

    const dayActions = elements(menus[0].props.children).filter(
      (child) => child.type === toolbar.MenuAction,
    );
    expect(dayActions).toHaveLength(31);
    expect(dayActions[14].props.children).toBe('15');
    expect(dayActions[14].props.isOn).toBe(true);

    dayActions[15].props.onPress?.();
    expect(onDateChange).toHaveBeenCalledWith('2026-10-16');

    const monthMenus = elements(menus[1].props.children).filter(
      (child) => child.type === toolbar.Menu,
    );
    expect(monthMenus.map((menu) => menu.props.title)).toEqual(['Mês', 'Ano']);
  });

  it('keeps the existing single menu for callers that do not opt in', () => {
    const menus = elements(
      renderNativeDateToolbarItems({
        mode: 'day',
        onDateChange: jest.fn(),
        selectedDate: '2026-10-15',
      }),
    );

    expect(menus).toHaveLength(1);
    expect(menus[0].props.accessibilityLabel).toBe('Selecionar data');
    expect(
      elements(menus[0].props.children)
        .filter((child) => child.type === toolbar.Menu)
        .map((menu) => menu.props.title),
    ).toEqual(['Mês', 'Ano', 'Dia']);
  });
});
