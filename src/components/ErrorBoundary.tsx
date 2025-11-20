import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error);
    console.error('Error info:', errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown error';
      const errorStack = this.state.error?.stack || '';

      return (
        <View style={styles.container}>
          <ScrollView style={styles.scroll}>
            <View style={styles.content}>
              <Text style={styles.title}>Erreur Sunbim</Text>

              <View style={styles.box}>
                <Text style={styles.label}>Message:</Text>
                <Text style={styles.text}>{errorMessage}</Text>
              </View>

              {errorStack ? (
                <View style={styles.box}>
                  <Text style={styles.label}>Details:</Text>
                  <Text style={styles.smallText} numberOfLines={30}>
                    {errorStack}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                <Text style={styles.buttonText}>Réessayer</Text>
              </TouchableOpacity>

              <Text style={styles.hint}>
                Si l'erreur persiste, fermez et relancez l'app
              </Text>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  box: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 3,
    borderLeftColor: '#f87171',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f87171',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: '#fff',
  },
  smallText: {
    fontSize: 11,
    color: '#999',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
});
