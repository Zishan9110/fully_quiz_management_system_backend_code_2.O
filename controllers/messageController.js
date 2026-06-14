const Message = require('../models/Message');
const asyncHandler = require('../middleware/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');

const buildConversationId = (id1, id2) => [id1, id2].sort().join('_');

exports.sendMessage = asyncHandler(async (req, res, next) => {
  const { receiverId, receiverModel, content, attachments } = req.body;
  const senderId = req.user?._id || req.admin?._id;
  const senderModel = req.user ? 'User' : 'Admin';

  const conversationId = buildConversationId(senderId.toString(), receiverId);
  const message = await Message.create({
    sender: senderId, senderModel, receiver: receiverId, receiverModel,
    content, attachments, conversationId
  });

  const { getIO } = require('../sockets');
  try { getIO().to(`user_${receiverId}`).emit('message', message); } catch {}

  res.status(201).json({ success: true, data: message });
});

exports.getConversation = asyncHandler(async (req, res) => {
  const myId = req.user?._id || req.admin?._id;
  const conversationId = buildConversationId(myId.toString(), req.params.userId);
  const messages = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(100);
  await Message.updateMany({ conversationId, receiver: myId, isRead: false }, { isRead: true, readAt: new Date() });
  res.json({ success: true, data: messages });
});

exports.getConversations = asyncHandler(async (req, res) => {
  const myId = (req.user?._id || req.admin?._id).toString();
  const conversations = await Message.aggregate([
    { $match: { conversationId: { $regex: myId } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$conversationId', lastMessage: { $first: '$$ROOT' }, unread: { $sum: { $cond: [{ $and: [{ $eq: ['$isRead', false] }, { $eq: ['$receiver', { $toObjectId: myId }] }] }, 1, 0] } } } }
  ]);
  res.json({ success: true, data: conversations });
});

exports.broadcastMessage = asyncHandler(async (req, res, next) => {
  const { content, receiverIds } = req.body;
  const messages = receiverIds.map(rid => ({
    sender: req.admin._id, senderModel: 'Admin',
    receiver: rid, receiverModel: 'User',
    content, isBroadcast: true,
    conversationId: buildConversationId(req.admin._id.toString(), rid)
  }));
  await Message.insertMany(messages);
  res.json({ success: true, message: `Broadcast sent to ${receiverIds.length} students` });
});
