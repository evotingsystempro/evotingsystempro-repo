import React, { memo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingViewBase, KeyboardAvoidingView } from 'react-native';
import { Entypo, MaterialIcons } from '@expo/vector-icons';

type Props = {
  currentMessage: string;
  setCurrentMessage: (text: string) => void;
  inputHeight: number;
  setInputHeight: (height: number) => void;
  onSend: () => void;
};

const InputBar = ({
  currentMessage,
  setCurrentMessage,
  inputHeight,
  setInputHeight,
  onSend
}: Props) => {
  return (
 
        <View style={[styles.inputWrapper, { marginBottom: Platform.OS === 'ios' ? 40 : 5 }]}>
      <TouchableOpacity style={{ position: "relative", top: -9 }}>
        <Entypo name="emoji-happy" size={24} color="#555" />
      </TouchableOpacity>

      <TextInput
        value={currentMessage}
        onChangeText={setCurrentMessage}
        placeholder="Message"
        multiline
        onContentSizeChange={(e) =>
          setInputHeight(Math.min(e.nativeEvent.contentSize.height, 120))
        }
        style={[styles.input, { height: Math.max(40, inputHeight) }]}
        placeholderTextColor="#999"
      />

      <TouchableOpacity style={{ position: "relative", top: -9 }}>
        <MaterialIcons name="attach-file" size={24} color="#555" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.sendButton} onPress={onSend}>
        <MaterialIcons name="send" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    marginTop: 10,
    margin: 10,
    paddingVertical: 2,
    backgroundColor: '#ffffffce',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingTop: 8,
    paddingBottom: 8,
    marginHorizontal: 8,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#25D366',
    padding: 10,
    position: "relative",
    left: 5,
    borderRadius: 10,
  },
});

export default memo(InputBar);
