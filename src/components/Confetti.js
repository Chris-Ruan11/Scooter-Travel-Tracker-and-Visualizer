import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

const Confetti = ({ count = 50, colors = ['#FFD700', '#FF6347', '#4CAF50', '#2196F3', '#FF69B4', '#FFA500'] }) => {
  const confettiPieces = useRef([...Array(count)].map(() => ({
    x: new Animated.Value(Math.random() * width),
    y: new Animated.Value(-50),
    rotate: new Animated.Value(0),
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 300,
    duration: 2000 + Math.random() * 1000,
  }))).current;

  useEffect(() => {
    const animations = confettiPieces.map((piece) => {
      return Animated.parallel([
        Animated.timing(piece.y, {
          toValue: height + 50,
          duration: piece.duration,
          delay: piece.delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotate, {
          toValue: 360 * (3 + Math.random() * 2), // 3-5 rotations
          duration: piece.duration,
          delay: piece.delay,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(20, animations).start();
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {confettiPieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confetti,
            {
              backgroundColor: piece.color,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                {
                  rotate: piece.rotate.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});

export default Confetti;