import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { clayStyles } from '../../styles/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = "Buscar..." }) => {
  const currentTheme = useAppStore(state => state.currentTheme);;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.card, borderColor: currentTheme.border, shadowColor: currentTheme.borderShadow || '#000', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 4 }, elevation: 4 }]}>
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
    paddingHorizontal: 16,
    height: 52,
    borderRadius: clayStyles.borderRadius,
    borderWidth: clayStyles.borderWidth,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});
