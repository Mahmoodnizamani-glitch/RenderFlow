import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppInput } from '../AppInput';
import { TestWrapper } from './testUtils';

jest.useFakeTimers();

afterEach(() => {
    jest.runOnlyPendingTimers();
});

describe('AppInput', () => {
    it('renders with label', () => {
        const { getAllByText } = render(
            <TestWrapper>
                <AppInput label="Email" value="" onChangeText={() => { }} />
            </TestWrapper>,
        );
        expect(getAllByText('Email').length).toBeGreaterThanOrEqual(1);
    });

    it('calls onChangeText when text changes', () => {
        const onChangeText = jest.fn();
        const { getByTestId } = render(
            <TestWrapper>
                <AppInput
                    label="Name"
                    value=""
                    onChangeText={onChangeText}
                    testID="input-name"
                />
            </TestWrapper>,
        );
        fireEvent.changeText(getByTestId('input-name'), 'John');
        expect(onChangeText).toHaveBeenCalledWith('John');
    });

    it('displays error message', () => {
        const { getByText } = render(
            <TestWrapper>
                <AppInput
                    label="Password"
                    value="abc"
                    onChangeText={() => { }}
                    error="Too short"
                />
            </TestWrapper>,
        );
        expect(getByText('Too short')).toBeTruthy();
    });

    it('displays helper text when no error', () => {
        const { getByText } = render(
            <TestWrapper>
                <AppInput
                    label="Username"
                    value=""
                    onChangeText={() => { }}
                    helperText="Must be unique"
                />
            </TestWrapper>,
        );
        expect(getByText('Must be unique')).toBeTruthy();
    });

    it('shows error instead of helper text when both provided', () => {
        const { getByText, queryByText } = render(
            <TestWrapper>
                <AppInput
                    label="Field"
                    value=""
                    onChangeText={() => { }}
                    error="Invalid"
                    helperText="Some help"
                />
            </TestWrapper>,
        );
        expect(getByText('Invalid')).toBeTruthy();
        expect(queryByText('Some help')).toBeNull();
    });
});
