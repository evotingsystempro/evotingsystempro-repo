import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

type MessageItemProps = {
  item: any;
  userName: string;
};

const MessageItem = ({ item, userName }: MessageItemProps) => {
  const isCurrentUser = item.client_nickname === userName;

  return (
    <View style={[{
      alignSelf: isCurrentUser ? "flex-end" : 'flex-start',
      flexDirection: "row",
      marginHorizontal: 10
    }]} >
      {!isCurrentUser && (
        <FontAwesome name='user-circle' size={35} color={"#ccc"} />
      )}
      <View style={[styles.messageBubble, {
        backgroundColor: isCurrentUser
          ? "rgba(13, 173, 133, 0.78)"
          : "rgba(10, 174, 180, 0.95)"
      }]}>
        {!isCurrentUser && (
          <Text style={styles.senderName}>{item.client_nickname}</Text>
        )}
        <View style={{ flexDirection: "row" }}>
          <Text style={styles.messageText}>
            {item.text}
            <Text style={styles.timeText}>
              {item.status} { } {
                item.timestamp?.seconds
                  ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : "Sending..."
              }
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageBubble: {
    padding: 5,
    paddingHorizontal: 10,
    margin: 2,
    borderRadius: 15,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: "#fff"
  },
  senderName: {
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
    fontSize: 16
  },
  messageText: {
    lineHeight: 20,
    color: '#fff',
    marginBottom: 2,
    fontSize: 16
  },
  timeText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: "900"
  },
});

export default memo(MessageItem);
