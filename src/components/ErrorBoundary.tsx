import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface State {
  hasError: boolean;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.text}>Oups, une petite erreur est survenue.</Text>
          <Text style={styles.subText}>Redémarrez l'application.</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#000' 
  },
  text: { 
    color: '#FFF', 
    fontSize: 18, 
    fontWeight: 'bold',
    marginBottom: 10
  },
  subText: {
    color: '#999',
    fontSize: 14
  }
});