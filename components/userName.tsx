import * as React from "react";
import { View, Text } from "react-native"
import { useAuth } from "@/context/auth";

export const UserName = () => {
    const { user } = useAuth();
    return (
        <View>
            {user ? (<View>
               <Text style={{ fontSize: 18, paddingLeft: 5 , color: "#04a62aff", fontWeight: "600" }}>
  {user ? user.name : "loading..."}
</Text>
            </View>) : ""}
        </View>
    )
}
