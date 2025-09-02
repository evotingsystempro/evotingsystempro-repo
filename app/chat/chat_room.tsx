import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  InteractionManager,
  Keyboard,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

//import MessageItem from './MessageItem';
//import CustomLoaderV2 from '@/ComponentsFolder/CustomLoaderV2';
//import InputBar from './InputBar';
import { debounce } from 'lodash';
import { GoogleGenerativeAI } from '@google/generative-ai';
//import { AI_TRAINING_DATASET } from '@/components/aiTrainingDataset';
//import MessageItem from '@/components/MessageItem';
//import InputBar from '@/components/InputBar';
//import { logoutUser } from '@/utils/logoutUser';
import { router } from 'expo-router';
import InputBar from '@/components/InputBar';
import { logoutUser } from '@/utils/logoutUser';
import { AI_TRAINING_DATASET } from '@/hooks/aiTrainingDataset';
import MessageItem from '@/components/MessageItem';


const aiTrainingDataSetObj: any = []

const chat_room = () => {
  const user: any = auth.currentUser;
  let userName = user.displayName = user.displayName || 'Anonymous';
  // let { objcolors, userName, setUserName } = useContext(GlobalContext);
  let randomNumber = Math.random();
  const [loaderStatus, setLoaderStatus] = useState(true);
  const [showFlatListView, setShowFlatListView] = useState(false);
  let [loaderCounter, setLoaderCounter] = useState(0);
  let [newMessage, setNewMessage]: any = useState([]);
  let [messages, setMessages]: any = useState([]);
  const [inputHeight, setInputHeight] = useState(40); // Start with one line
  const [currentMessage, setCurrentMessage]: any = useState('');
  const [lastDocSnapshot, setLastDocSnapshot]: any = useState(null);
  const fetchedIds = useRef<Set<string>>(new Set());
  const flatListRef: any = useRef(null);
  let [ai_msg_index, set_ai_msg_index] = useState(0)
  let [ai_msg_obj, set_ai_msg_obj]: any = useState([])
  let [aiTrainingDataSet, setAiTrainingDataSet] = useState(aiTrainingDataSetObj)


  //====== START FETCH ON_MOUNT ====
  useEffect(() => {
    const getMessagesFun = async () => {
      try {
        const jsonValue = await AsyncStorage.getItem('savedMessages');
        if (jsonValue) {
          const parsed = JSON.parse(jsonValue);
          setMessages(messages = parsed);
        }
      } catch (error) {
        console.error("Failed to load messages from storage:", error);
      }
    };
    getMessagesFun();
  }, []);
  //====== END FETCH ON_MOUNT ====


  const uuId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 15; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }



  //====== START DEBOUNCE ====
  const DEBOUNCE_DELAY = 500;
  const saveMessagesDebounced = debounce(async (messages: any) => {
    try {
      await AsyncStorage.setItem('savedMessages', JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }, DEBOUNCE_DELAY);
  useEffect(() => {
    saveMessagesDebounced(messages);
    return () => {
      saveMessagesDebounced.cancel();
    };
  }, [messages]);
  //====== END DEBOUNCE  ====
  /*
   useEffect(() => {
    aiTrainingDataSet.map((item,idex)=>{
    console.log(item.Category)
  })
    }, []);
  
  */

  /* useEffect(() => {
     setTimeout(() => {
       flatListRef.current?.scrollToEnd({ animated: true });
     }, 100);
   }, [messages])
 */
  const findLocalResponse = (queryFromUser: any) => {
    const normalizedInput = queryFromUser.toLowerCase();

    // Simple match: if user input contains part of the dataset query
    const foundItem = AI_TRAINING_DATASET.find(item =>
      normalizedInput.includes(item.query.toLowerCase()) ||
      item.query.toLowerCase().includes(normalizedInput)
    );
    foundItem ? sendMessageAi(foundItem.response) : AiResponseMessage(queryFromUser)
    // return foundItem ? foundItem.response : null;
  };

  const AiResponseMessage = async (queryFromUser: any) => {
    console.log("LOADING AI RESPONSE ...");
    const genAI = new GoogleGenerativeAI("AIzaSyDfLN-C_arSu-gkK4MXLoiGhlxRXCHlwp0");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
Kindly answer the questions in asterisks and it must be natural human interaction manner but do not include characters or asterisks in your response but Emojis are allow and your response must not be more than 30 words *${queryFromUser}*`;
    await model.generateContent(prompt).then((result: any) => {
      let ai_text = result.response.text()
      sendMessageAi(ai_text)
      console.log('Ai Response TEXT:', ai_text);
      console.log("ai_msg_index:AAAA:", ai_msg_index);
      console.log("ai_msg_index:BBBB:", ai_msg_obj);
    }).catch((error: any) => {
      console.error('Ai Error Msg:', error);
    });
  }

  //0555515292

  //====== START AI MSGS ====
  const sendMessageAi = useCallback(async (ai_text: any) => {
    if (ai_text.trim() !== '') {
      let messageAiObj = {
        client_nickname: ai_msg_obj.client_nickname,
        txtMsgId: ai_msg_obj.txtMsgId,
        text: ai_text,
        timestamp: serverTimestamp(),
        status: '',
      }
      console.log("ai_msg_index:", ai_msg_index);
      console.log("messageAiObj:", messageAiObj);
      setMessages((prev: any) => {
        const updated = [...prev];
        updated[ai_msg_index] = { ...updated[ai_msg_index], text: ai_text };
        updated[ai_msg_index] = { ...updated[ai_msg_index], status: ' Pending...' };
        return updated;
      });
      try {
        await addDoc(collection(db, "ChatDB55"), messageAiObj);
        setMessages((prev: any) => {
          const updated = [...prev];
          updated[ai_msg_index] = { ...updated[ai_msg_index], status: ' Added' };
          return updated;
        });
        console.log('NAMEAi:', userName)
      } catch (error) {
        setMessages((prev: any) => {
          const updated = [...prev];
          updated[ai_msg_index] = { ...updated[ai_msg_index], status: 'fail' };
          return updated;
        });
        console.log("poor network");
      }
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [currentMessage, messages]);




  //====== END AI MSGS ====
  //====== START THE USER MSGS ====
  const sendMessage = useCallback(async (name: any) => {
    if (currentMessage.trim() !== '') {
      newMessage = {
        client_nickname: name,
        txtMsgId: uuId(),
        text: currentMessage,
        timestamp: { seconds: Date.now() / 1000 },
        status: ' : pending',
      };

      if (!fetchedIds.current.has(newMessage.txtMsgId)) {
        fetchedIds.current.add(newMessage.txtMsgId);
      }
      let newMsgIndex = (1 + messages.length) - 1;
      setMessages((prev: any) => {
        const updated = [...prev];
        updated[newMsgIndex] = newMessage;
        return updated;
      });

      setCurrentMessage('');

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      setTimeout(() => {
        //------
        let AiResponseObj = {
          client_nickname: 'Lydia',
          txtMsgId: uuId(),
          text: '',
          timestamp: { seconds: Date.now() / 1000 },
          status: 'Loading..',
        };
        if (!fetchedIds.current.has(AiResponseObj.txtMsgId)) {
          fetchedIds.current.add(AiResponseObj.txtMsgId);
        }
        set_ai_msg_index(ai_msg_index = newMsgIndex + 1)
        set_ai_msg_obj(ai_msg_obj = AiResponseObj)
        setMessages((prev: any) => {
          const updated = [...prev];
          updated[ai_msg_index] = AiResponseObj;
          return updated;
        });
        console.log("Comment added successfully", newMsgIndex);
        processQueue(newMsgIndex)
        setInputHeight(40); // Reset height to initial value

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        //------
      }, 2000)

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);


    }
  }, [currentMessage, messages]);


  const processQueue = async (newMsgIndex: any) => {
    let messageObj = {
      client_nickname: newMessage.client_nickname,
      txtMsgId: newMessage.txtMsgId,
      text: newMessage.text,
      timestamp: serverTimestamp(),
      status: '',
    }
    try {
      console.log("running 3");
      await addDoc(collection(db, "ChatDB55"), messageObj);
      setMessages((prev: any) => {
        const updated = [...prev];
        updated[newMsgIndex] = { ...updated[newMsgIndex], status: ' Sent' };
        return updated;
      });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      setNewMessage(newMessage);
      console.log('NAME:', userName)
      findLocalResponse(messageObj.text);
    } catch (error) {
      setMessages((prev: any) => {
        const updated = [...prev];
        updated[newMsgIndex] = { ...updated[newMsgIndex], status: 'fail' };
        return updated;
      });
      setNewMessage(newMessage);
      console.log("poor network");
    }
  };
  //====== END THE USER MSGS ====






  const setupListener = async () => {
    try {
      let startingPoint = null;
      if (!lastDocSnapshot) {
        const savedId = await AsyncStorage.getItem('lastDocId');
        if (savedId) {
          await getDoc(doc(db, 'ChatDB55', savedId)).then((docSnap) => {
            if (docSnap.exists()) {
              console.log("Document fetched successfully")
              startingPoint = docSnap;
            } else {
              console.log("No doc available")
            }
          }).catch((error) => {
            console.log("Get document failed:offline")
          })
        }
      } else {
        startingPoint = lastDocSnapshot;
      }


      const q = startingPoint
        ? query(
          collection(db, 'ChatDB55'),
          orderBy('timestamp', 'asc'),
          startAfter(startingPoint),
          limit(50)
        )
        : query(
          collection(db, 'ChatDB55'),
          orderBy('timestamp', 'asc'),
          limit(50)
        );
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        //console.log(`Snapshot received. Doc count: ${snapshot.size}`);
        if (snapshot.empty) {
          console.log("No new documents.");
          return;
        }
        snapshot.forEach(async (docSnap) => {
          const data = docSnap.data();
          if (!data?.timestamp) return;
          const i = data.txtMsgId;


          const foundItem = messages.find((item: any) =>
            item.textMsgId.includes(i)
          );
          if (foundItem) {
            fetchedIds.current.add(i);
            setMessages((prev: any) => [...prev, data]);
            const lastVisible = snapshot.docs[snapshot.docs.length - 1];
            setLastDocSnapshot(lastVisible);
            await AsyncStorage.setItem("lastDocId", lastVisible.id);
            console.log("RESULT 2");
          }
        });
      });
      return unsubscribe; // Return to cleanup in useEffect
    } catch (error) {
      console.error("Error in setupListener:", error);
      return () => { };
    }
  };


  useEffect(() => {
    let unsubscribeFunc: any;
    setupListener().then((unsubscribe) => {
      unsubscribeFunc = unsubscribe;
    });

    return () => {
      if (unsubscribeFunc) {
        unsubscribeFunc();
      }
    };
  }, []);



  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
    });
    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  //=======

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setInputHeight(40); // Reset height to initial value
      }
    );
    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);


  const handleLogout = () => {
    console.log("RUNNING LOGOUT FUNCTION");
    logoutUser(
      () => {
        console.log("Logout successful");
        router.navigate('./login');
      },
      (err: any) => {
        // Error callback
        console.log("Logout failed: " + err.message);
      }
    );
  };

  
  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => (
          <MessageItem item={item} userName={userName} />
        )}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.messagesContainer}
      // initialNumToRender={3} // How many items to render initially
      //  maxToRenderPerBatch={15} // How many items to render per batch
      // onScroll={(event:any)=>handleScroll(event)}
      // onMomentumScrollEnd={(event:any)=>handleScroll(event)}

      />
      <InputBar
        currentMessage={currentMessage}
        setCurrentMessage={setCurrentMessage}
        inputHeight={inputHeight}
        setInputHeight={setInputHeight}
        onSend={() => sendMessage(userName)}

      />
    </View>
  );
};


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e6f7e6' },
  messagesContainer: { flexGrow: 1, paddingVertical: 10, justifyContent: 'flex-end' },
});

export default chat_room;
