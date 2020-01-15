import sys
import ta
import pandas as pd
from sklearn.preprocessing import minmax_scale
import numpy as np
import tensorflow as tf

sess=tf.Session() 
signature_key = tf.saved_model.signature_constants.DEFAULT_SERVING_SIGNATURE_DEF_KEY
input_key = 'x_input'
output_key = 'y_output'

import_path =  './decider_python'
meta_graph_def = tf.saved_model.loader.load(sess, [tf.saved_model.tag_constants.SERVING], import_path)
signature = meta_graph_def.signature_def

x_tensor_name = signature[signature_key].inputs[input_key].name
y_tensor_name = signature[signature_key].outputs[output_key].name

x = sess.graph.get_tensor_by_name(x_tensor_name)
y = sess.graph.get_tensor_by_name(y_tensor_name)


f = open("observations.txt","w")


while True:

    args = input()
    arg_array = args.split(' ')

    timestamps = [ int(n) for n in arg_array[0].split(',') ]
    opens = [ float(n) for n in arg_array[1].split(',') ]
    high = [ float(n) for n in arg_array[2].split(',') ]
    low = [ float(n) for n in arg_array[3].split(',') ]
    close = [ float(n) for n in arg_array[4].split(',') ]
    volume = [ float(n) for n in arg_array[5].split(',') ]
    asset = float(arg_array[6])
    currency = float(arg_array[7])
    profit = float(arg_array[8])
    avgPrice = float(arg_array[9])




    df = pd.DataFrame({'Timestamp': timestamps, 'Open': opens, 'High': high, 'Low': low, 'Close': close, 'Volume': volume}).set_index('Timestamp')


    ta.add_all_ta_features(df, open="Open", high="High", low="Low", close="Close", volume="Volume")


    columns = df.columns.values.tolist()
    columns.remove('momentum_kama') # was all nans


    signals = np.nan_to_num(df.loc[:, columns].to_numpy())

    signal_features = minmax_scale(signals)

    state = signal_features[-1]

    obs = np.append(state, [asset, currency, profit, avgPrice])

    f.write(str(timestamps[-1])+' '+np.array_str(obs[-5 : -1], precision=5, max_line_width=1200)+'\n')

    pred = sess.run(y, {x: [obs]})
    # print(y)
    # pred = sess.run(y, {x: [state]})
    # print(np.sum(pred[0]))
    print('{d[0]:04.8f} {d[1]:04.8f} {d[2]:04.8f}'.format(d=pred[0])) #output

    # for c,v in zip(columns, df.iloc[-1,:]):
    #     print(c, v)
    sys.stdout.flush()
# end while loop