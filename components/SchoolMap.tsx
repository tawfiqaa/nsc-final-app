import React from 'react';
import { Text, View } from 'react-native';

export default function SchoolMap({ style, children, ...props }: any) {
    return (
        <View style={[{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }, style]}>
            <Text style={{ color: '#666' }}>Map preview is only available on mobile</Text>
            {children}
        </View>
    );
}

export const Marker = (props: any) => null;
