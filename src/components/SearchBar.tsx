import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = "Buscar..." }) => {
  const { currentTheme } = useAppStore();

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.card, borderColor: currentTheme.border }]}>
      <Ionicons name="search-outline" size={20} color={currentTheme.textSecondary} style={styles.icon} />
      <TextInput
        style={[styles.input, { color: currentTheme.text }]}
        placeholder={placeholder}
        placeholderTextColor={currentTheme.textSecondary}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 15,
    paddingHorizontal: 12,
    height: 45,
    borderRadius: 10,
    borderWidth: 1,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});
