import React, { useContext } from "react";
import { View, Text, Alert, Platform, Share } from "react-native";
import { Menu, MenuOptions, MenuOption, MenuTrigger } from "react-native-popup-menu";
import { MaterialIcons } from "@expo/vector-icons";
import { GlobalContext } from "@/context";

export default function PupupMenuForScoreReset({
  Press_free_reset_credit,
  free_reset_credit,
  Press_pay_as_you_go,
  pay_as_you_go,
  Press_monthly_subscription_plan,
  monthly_subscription_plan,
  Press_buy_reset_credit,
  isOwner,
}: any) {

  const ownerStyle = { opacity: isOwner ? 1 : 0.4 };

  return (
    <Menu style={{ marginLeft: 20 }}>
      <MenuTrigger>
        <View style={{ position: "relative", right: 7, flexDirection: "row", alignItems: "center" }}>
          <MaterialIcons name="restart-alt" size={20} color="#f5ba80ff" style={menuStyle.icon} />
          <Text style={{ color: "#f98f24ff", position: "relative", right: 9 }}>Reset</Text>
        </View>
      </MenuTrigger>

      <MenuOptions
        customStyles={{
          optionsContainer: {
            borderRadius: 10,
            minWidth: 230,
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 4 },
            elevation: 8,
            right: 0,
            top: 35,
          },
        }}
      >
        {/* Header — non-interactive */}
        <MenuOption disabled style={menuStyle.option}>
          <MaterialIcons name="restart-alt" size={20} color="#555" style={menuStyle.icon} />
          <Text style={[menuStyle.text, { color: "#555" }]}>Reset Credit Options</Text>
        </MenuOption>

        <View style={menuStyle.divider} />

        {/* Free reset */}
        <MenuOption onSelect={Press_free_reset_credit} style={[menuStyle.option, ownerStyle]}>
          <MaterialIcons name="money-off" size={20} color="#1ab605ff" style={menuStyle.icon} />
          <Text style={menuStyle.text}>Free reset credits: {free_reset_credit ?? "0"}</Text>
        </MenuOption>


        {/* Paid reset */}
        <MenuOption onSelect={Press_pay_as_you_go} style={[menuStyle.option, ownerStyle]}>
          <MaterialIcons name="payment" size={20} color="#2076efff" style={menuStyle.icon} />
          <Text style={menuStyle.text}>Pay as you go: {pay_as_you_go ?? "0"}</Text>
        </MenuOption>

        {/* Monthly plan */}
        <MenuOption onSelect={Press_monthly_subscription_plan} style={[menuStyle.option, ownerStyle]}>
          <View style={{ flexDirection: "column", marginBottom: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <MaterialIcons name="card-giftcard" size={20} color="#f5a623ff" style={menuStyle.icon} />
              <Text style={menuStyle.text}>Monthly plan: {monthly_subscription_plan ?? "0"}</Text>
            </View>
            {/*  <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 28, marginTop: 2 }}>
              <Text style={{ fontSize: 12, color: "#555" }}>Status:</Text>
            </View> */}
          </View>



        </MenuOption>

        <View style={menuStyle.divider} />

        {/* Buy credits — onSelect moved to MenuOption (was wrongly on MaterialIcons) */}
        <MenuOption onSelect={Press_buy_reset_credit} style={[menuStyle.option, ownerStyle]}>
          <MaterialIcons name="add-shopping-cart" size={20} color="#e81e04ff" style={menuStyle.icon} />
          <Text style={[menuStyle.text, { color: "#e81e04ff" }]}>Buy Reset Credit</Text>
        </MenuOption>

      </MenuOptions>
    </Menu>
  );
}

const menuStyle = {
  option: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    fontSize: 15,
    color: "#333",
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 5,
  },
};